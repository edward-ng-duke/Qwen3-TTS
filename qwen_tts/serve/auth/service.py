import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import bcrypt
import jwt

from .config import AuthConfig
from .models import UserDocument


def hash_password_sha256(password: str, salt: str) -> str:
    salted = f"{salt}{password}{salt}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()


def verify_password_sha256(password: str, salt: str, password_hash: str) -> bool:
    return hmac.compare_digest(hash_password_sha256(password, salt), password_hash)


class AuthService:
    def __init__(self, config: AuthConfig, repository):
        self.config = config
        self.repository = repository

    @staticmethod
    def hash_password_bcrypt(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    @staticmethod
    def verify_password_bcrypt(password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except ValueError:
            return False

    @staticmethod
    def is_bcrypt_hash(password_hash: str) -> bool:
        return password_hash.startswith(("$2a$", "$2b$", "$2y$"))

    def create_token(self, user: UserDocument, expire_days: Optional[int] = None) -> str:
        now = datetime.now(timezone.utc)
        days = expire_days if expire_days is not None else self.config.jwt_expire_days
        role = user.role.value if hasattr(user.role, "value") else user.role
        payload = {
            "sub": user.id,
            "username": user.username,
            "role": role,
            "iat": now,
            "exp": now + timedelta(days=days),
        }
        return jwt.encode(payload, self.config.jwt_secret_key, algorithm=self.config.jwt_algorithm)

    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            return jwt.decode(
                token,
                self.config.jwt_secret_key,
                algorithms=[self.config.jwt_algorithm],
            )
        except jwt.PyJWTError:
            return None

    async def user_from_token(self, token: str) -> Optional[UserDocument]:
        payload = self.decode_token(token)
        if not payload or not payload.get("sub"):
            return None
        user = await self.repository.get_by_id(str(payload["sub"]))
        if not user or not user.is_active():
            return None
        return user

    async def authenticate(
        self,
        username: str,
        password: str,
        remember_me: bool = False,
    ) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        user = await self.repository.get_by_username(username)
        if not user or not user.is_active() or not user.password_hash:
            return None, None

        password_ok = False
        if self.is_bcrypt_hash(user.password_hash):
            password_ok = self.verify_password_bcrypt(password, user.password_hash)
        else:
            password_ok = verify_password_sha256(password, user.salt, user.password_hash)
            if password_ok:
                migrated_hash = self.hash_password_bcrypt(password)
                await self.repository.update_password(user.id, migrated_hash, "")
                user.password_hash = migrated_hash
                user.salt = ""

        if not password_ok:
            return None, None

        await self.repository.update_last_login(user.id)
        expire_days = 30 if remember_me else None
        return self.create_token(user, expire_days=expire_days), user.to_public_dict()

