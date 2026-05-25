from typing import Any, Dict, Optional

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError

from .models import UserDocument, UserRole, UserStatus, get_cst_now


def _id_filter(user_id: str) -> Dict[str, Any]:
    try:
        return {"_id": {"$in": [ObjectId(user_id), user_id]}}
    except (InvalidId, Exception):
        return {"_id": user_id}


class UserRepository:
    def __init__(self, db, collection_name: str = "users"):
        self.collection = db[collection_name]

    async def ensure_indexes(self) -> None:
        existing = await self.collection.index_information()
        has_username_index = any(
            spec.get("key") == [("username", 1)] for spec in existing.values()
        )
        if not has_username_index:
            await self.collection.create_index(
                [("username", 1)],
                unique=True,
                name="idx_username_unique",
            )
        for field, name in (
            ("role", "idx_role"),
            ("status", "idx_status"),
            ("created_at", "idx_created_at"),
        ):
            has_index = any(spec.get("key") == [(field, -1 if field == "created_at" else 1)]
                            for spec in existing.values())
            if not has_index:
                direction = -1 if field == "created_at" else 1
                await self.collection.create_index([(field, direction)], name=name)

    async def get_by_id(self, user_id: str) -> Optional[UserDocument]:
        data = await self.collection.find_one(_id_filter(user_id))
        return UserDocument.from_mongo_dict(data)

    async def get_by_username(self, username: str) -> Optional[UserDocument]:
        data = await self.collection.find_one({"username": username})
        return UserDocument.from_mongo_dict(data)

    async def update_last_login(self, user_id: str) -> bool:
        now = get_cst_now()
        result = await self.collection.update_one(
            _id_filter(user_id),
            {"$set": {"last_login": now, "updated_at": now}},
        )
        return result.modified_count > 0

    async def update_password(self, user_id: str, password_hash: str, salt: str) -> bool:
        result = await self.collection.update_one(
            _id_filter(user_id),
            {"$set": {"password_hash": password_hash, "salt": salt, "updated_at": get_cst_now()}},
        )
        return result.modified_count > 0

    async def upsert_es_user(self, payload: Dict[str, Any]) -> Optional[UserDocument]:
        username = payload["username"]
        existing = await self.get_by_username(username)
        now = get_cst_now()
        if existing:
            if not existing.is_active():
                return existing
            updates = {
                "display_name": payload.get("display_name") or username,
                "role": payload.get("role") or UserRole.USER.value,
                "auth_source": "es",
                "last_login": now,
                "updated_at": now,
            }
            await self.collection.update_one(_id_filter(existing.id), {"$set": updates})
            data = existing.model_dump()
            data.update(updates)
            return UserDocument(**data)

        doc = UserDocument(
            username=username,
            password_hash="",
            salt="",
            display_name=payload.get("display_name") or username,
            role=payload.get("role") or UserRole.USER.value,
            status=UserStatus.ACTIVE,
            auth_source="es",
            created_by="es_token",
            last_login=now,
        )
        try:
            result = await self.collection.insert_one(doc.to_mongo_dict())
        except DuplicateKeyError:
            return await self.get_by_username(username)
        doc.id = str(result.inserted_id)
        return doc

