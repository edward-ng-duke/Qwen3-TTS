import logging
from collections import defaultdict, deque
from typing import Deque, Dict, Optional

from .config import ShareConfig
from .store import ShareStore

log = logging.getLogger(__name__)


class ShareState:
    """Owns the share Mongo connection + store, with the same lifecycle shape as
    ``AuthState``. ``store`` may be injected (tests) to skip the real Mongo."""

    def __init__(
        self,
        config: ShareConfig,
        store: Optional[ShareStore] = None,
        error: Optional[str] = None,
    ):
        self.config = config
        self.store = store
        self.error = error
        self.mongo_client = None
        # Per-IP sliding-window hit log for the regenerate rate limiter. Lives on
        # the state (not module-global) so each app instance is isolated.
        self.regen_hits: Dict[str, Deque[float]] = defaultdict(deque)

    @classmethod
    def from_env(cls) -> "ShareState":
        return cls(ShareConfig.from_env())

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    @property
    def ready_for_requests(self) -> bool:
        return self.enabled and self.error is None and self.store is not None

    async def startup(self) -> None:
        if not self.config.enabled or self.store is not None:
            return
        try:
            from motor.motor_asyncio import AsyncIOMotorClient

            self.mongo_client = AsyncIOMotorClient(
                self.config.mongo_url,
                serverSelectionTimeoutMS=self.config.mongo_timeout_ms,
                connectTimeoutMS=self.config.mongo_timeout_ms,
                maxPoolSize=self.config.mongo_max_pool_size,
            )
            db = self.mongo_client[self.config.db_name]
            self.store = ShareStore(db, self.config.shared_dir, self.config.collection)
            await self.store.ensure_indexes()
            log.info(
                "Share enabled (db=%s collection=%s dir=%s)",
                self.config.db_name, self.config.collection, self.config.shared_dir,
            )
        except Exception as exc:  # pragma: no cover - depends on live Mongo
            self.error = f"share storage unavailable: {exc}"
            log.exception("Share startup failed")

    async def shutdown(self) -> None:
        if self.mongo_client is not None:
            self.mongo_client.close()
