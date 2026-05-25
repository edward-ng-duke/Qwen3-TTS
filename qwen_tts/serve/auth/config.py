import os
from dataclasses import dataclass
from typing import Optional


def _truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_int(key: str, default: int) -> int:
    value = os.environ.get(key)
    if value is None or value == "":
        return default
    return int(value)


@dataclass
class AuthConfig:
    enabled: bool = False
    jwt_secret_key: str = ""
    jwt_expire_days: int = 7
    jwt_algorithm: str = "HS256"
    access_cookie_name: str = "access_token"
    cookie_secure: bool = False

    mongo_url: str = "mongodb://localhost:27017"
    db_name: str = "conference_ws"
    mongo_timeout_ms: int = 5000
    mongo_max_pool_size: int = 10

    es_auth_enabled: bool = False
    es_auth_url: str = "http://10.0.0.33:9201"
    es_user_index: str = "mygpt_user"
    es_auth_timeout: int = 5
    es_token_cookie_name: str = "token2"
    es_token_header_name: str = "X-token-2"

    @classmethod
    def from_env(cls) -> "AuthConfig":
        auth_mode = (os.environ.get("AUTH_ENABLED") or "auto").strip().lower()
        mongo_enabled = _truthy(os.environ.get("MONGO_ENABLED"))
        es_enabled = _truthy(os.environ.get("ES_AUTH_ENABLED"))
        has_shared_jwt_mongo = (
            "MONGO_URL" in os.environ
            and "JWT_SECRET_KEY" in os.environ
            and bool(os.environ.get("MONGO_URL"))
            and bool(os.environ.get("JWT_SECRET_KEY"))
        )

        if auth_mode in {"0", "false", "no", "off"}:
            enabled = False
        elif auth_mode in {"1", "true", "yes", "on"}:
            enabled = True
        else:
            enabled = mongo_enabled or es_enabled or has_shared_jwt_mongo

        return cls(
            enabled=enabled,
            jwt_secret_key=os.environ.get("JWT_SECRET_KEY", ""),
            jwt_expire_days=_get_int("JWT_EXPIRE_DAYS", 7),
            access_cookie_name=os.environ.get("AUTH_ACCESS_COOKIE_NAME", "access_token"),
            cookie_secure=_truthy(os.environ.get("AUTH_COOKIE_SECURE")),
            mongo_url=os.environ.get("MONGO_URL", cls.mongo_url),
            db_name=os.environ.get("DB_NAME", cls.db_name),
            mongo_timeout_ms=_get_int("MONGO_TIMEOUT_MS", cls.mongo_timeout_ms),
            mongo_max_pool_size=_get_int("MONGO_MAX_POOL_SIZE", cls.mongo_max_pool_size),
            es_auth_enabled=es_enabled,
            es_auth_url=os.environ.get("ES_AUTH_URL", cls.es_auth_url),
            es_user_index=os.environ.get("ES_USER_INDEX", cls.es_user_index),
            es_auth_timeout=_get_int("ES_AUTH_TIMEOUT", cls.es_auth_timeout),
            es_token_cookie_name=os.environ.get("ES_TOKEN_COOKIE_NAME", cls.es_token_cookie_name),
            es_token_header_name=os.environ.get("ES_TOKEN_HEADER_NAME", cls.es_token_header_name),
        )

    @property
    def missing_secret(self) -> bool:
        return self.enabled and not self.jwt_secret_key
