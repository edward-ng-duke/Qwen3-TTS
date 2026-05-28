import hashlib
import logging
from typing import Optional

from .config import AuthConfig
from .es_service import EsAuthService
from .repository import UserRepository
from .service import AuthService

log = logging.getLogger(__name__)


class AuthState:
    def __init__(
        self,
        config: AuthConfig,
        repository=None,
        auth_service: Optional[AuthService] = None,
        es_auth_service: Optional[EsAuthService] = None,
        error: Optional[str] = None,
    ):
        self.config = config
        self.repository = repository
        self.auth_service = auth_service
        self.es_auth_service = es_auth_service
        self.error = error
        self.mongo_client = None

    @classmethod
    def from_env(cls) -> "AuthState":
        return cls(AuthConfig.from_env())

    @classmethod
    def ready(cls, config: AuthConfig, repository, es_auth_service=None) -> "AuthState":
        auth_service = AuthService(config, repository)
        return cls(
            config=config,
            repository=repository,
            auth_service=auth_service,
            es_auth_service=es_auth_service,
        )

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    @property
    def ready_for_requests(self) -> bool:
        return self.enabled and self.error is None and self.auth_service is not None

    async def startup(self) -> None:
        if not self.config.enabled:
            return
        if self.config.missing_secret:
            self.error = "JWT_SECRET_KEY is required when auth is enabled"
            log.error(self.error)
            return

        fingerprint = hashlib.sha256(self.config.jwt_secret_key.encode("utf-8")).hexdigest()[:8]
        log.info("Auth enabled jwt_fp=%s", fingerprint)
        if self.auth_service is not None:
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
            self.repository = UserRepository(db)
            await self.repository.ensure_indexes()
            self.auth_service = AuthService(self.config, self.repository)
            if self.config.es_auth_enabled:
                self.es_auth_service = EsAuthService(self.config, self.repository)
        except Exception as exc:
            self.error = f"auth storage unavailable: {exc}"
            log.exception("Auth startup failed")

    async def shutdown(self) -> None:
        if self.es_auth_service is not None:
            await self.es_auth_service.close()
        if self.mongo_client is not None:
            self.mongo_client.close()
