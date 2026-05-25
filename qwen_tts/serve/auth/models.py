import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

try:
    from bson import ObjectId
except Exception:  # pragma: no cover - bson is provided with motor/pymongo
    ObjectId = str  # type: ignore

log = logging.getLogger(__name__)

CST = timezone(timedelta(hours=8))


def get_cst_now() -> datetime:
    return datetime.now(CST)


def format_datetime_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.isoformat()


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class UserStatus(str, Enum):
    ACTIVE = "active"
    DISABLED = "disabled"


class UserDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: Optional[str] = Field(default=None, alias="_id")
    username: str = Field(..., min_length=1, max_length=50)
    password_hash: str = ""
    salt: str = ""
    display_name: str = Field(default="", max_length=100)
    role: UserRole = UserRole.USER
    status: UserStatus = UserStatus.ACTIVE
    auth_source: str = "local"
    created_at: datetime = Field(default_factory=get_cst_now)
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=get_cst_now)
    last_login: Optional[datetime] = None

    def to_mongo_dict(self) -> Dict[str, Any]:
        data = self.model_dump(by_alias=True)
        if data.get("_id") is None:
            data.pop("_id", None)
        if isinstance(data.get("role"), UserRole):
            data["role"] = data["role"].value
        if isinstance(data.get("status"), UserStatus):
            data["status"] = data["status"].value
        return data

    @classmethod
    def from_mongo_dict(cls, data: Optional[Dict[str, Any]]) -> Optional["UserDocument"]:
        if data is None:
            return None
        payload = dict(data)
        if "_id" in payload:
            payload["_id"] = str(payload["_id"])
        if payload.get("created_by") is not None:
            payload["created_by"] = str(payload["created_by"])
        if not payload.get("display_name"):
            payload["display_name"] = payload.get("username", "")
        valid_roles = {role.value for role in UserRole}
        if payload.get("role") not in valid_roles:
            log.warning("Invalid user role %r for %s; falling back to user",
                        payload.get("role"), payload.get("username"))
            payload["role"] = UserRole.USER.value
        valid_statuses = {status.value for status in UserStatus}
        if payload.get("status") not in valid_statuses:
            payload["status"] = UserStatus.DISABLED.value
        return cls(**payload)

    def to_public_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name or self.username,
            "role": self.role.value if isinstance(self.role, UserRole) else self.role,
            "status": self.status.value if isinstance(self.status, UserStatus) else self.status,
            "auth_source": self.auth_source,
            "created_at": format_datetime_iso(self.created_at),
            "last_login": format_datetime_iso(self.last_login),
        }

    def is_active(self) -> bool:
        status = self.status.value if isinstance(self.status, UserStatus) else self.status
        return status == UserStatus.ACTIVE.value

    def is_admin(self) -> bool:
        role = self.role.value if isinstance(self.role, UserRole) else self.role
        return role == UserRole.ADMIN.value

