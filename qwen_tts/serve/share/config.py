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
class ShareConfig:
    enabled: bool = False
    mongo_url: str = "mongodb://localhost:27017"
    db_name: str = "conference_ws"
    collection: str = "tts_share_works"
    shared_dir: str = "/var/qwen-tts/shared"
    mongo_timeout_ms: int = 5000
    mongo_max_pool_size: int = 10
    # /v1/share/regenerate guardrails (public GPU access → must be bounded).
    regen_max_chars: int = 50
    regen_rate_per_min: int = 3

    @classmethod
    def from_env(cls) -> "ShareConfig":
        # SHARE_ENABLED=auto (default) turns sharing on whenever a Mongo URL is
        # configured — same "auto" spirit as AUTH_ENABLED.
        mode = (os.environ.get("SHARE_ENABLED") or "auto").strip().lower()
        has_mongo = bool(os.environ.get("MONGO_URL"))
        if mode in {"0", "false", "no", "off"}:
            enabled = False
        elif mode in {"1", "true", "yes", "on"}:
            enabled = True
        else:
            enabled = has_mongo

        return cls(
            enabled=enabled,
            mongo_url=os.environ.get("MONGO_URL", cls.mongo_url),
            db_name=os.environ.get("DB_NAME", cls.db_name),
            collection=os.environ.get("SHARE_COLLECTION", cls.collection),
            shared_dir=os.environ.get("SHARED_DIR", cls.shared_dir),
            mongo_timeout_ms=_get_int("MONGO_TIMEOUT_MS", cls.mongo_timeout_ms),
            mongo_max_pool_size=_get_int("MONGO_MAX_POOL_SIZE", cls.mongo_max_pool_size),
            regen_max_chars=_get_int("SHARE_REGEN_MAX_CHARS", cls.regen_max_chars),
            regen_rate_per_min=_get_int("SHARE_REGEN_RATE_PER_MIN", cls.regen_rate_per_min),
        )
