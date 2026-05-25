import logging
from typing import Any, Dict, Optional, Tuple

import httpx
from fastapi import Request

from .config import AuthConfig
from .models import UserRole

log = logging.getLogger(__name__)


class EsAuthService:
    def __init__(self, config: AuthConfig, repository, client: Optional[httpx.AsyncClient] = None):
        self.config = config
        self.repository = repository
        self._client = client
        self._owns_client = client is None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.config.es_auth_url,
                timeout=httpx.Timeout(self.config.es_auth_timeout),
            )
            self._owns_client = True
        return self._client

    async def close(self) -> None:
        if self._client is not None and self._owns_client:
            await self._client.aclose()

    def extract_token(self, request: Request) -> Optional[str]:
        token = request.cookies.get(self.config.es_token_cookie_name)
        if not token:
            token = request.headers.get(self.config.es_token_header_name)
        if not token:
            token = request.headers.get(self.config.es_token_header_name.lower())
        token = (token or "").strip().strip('"').strip("'")
        return token or None

    async def exchange_request(self, request: Request):
        token = self.extract_token(request)
        if not token:
            return None
        return await self.exchange_token(token)

    async def exchange_token(self, token: str):
        user_data = await self._query_token(token, strategy="term")
        if not user_data:
            user_data = await self._query_token(token, strategy="match")
        if not user_data:
            return None

        payload = self._normalize_user_data(user_data)
        if not payload:
            return None
        user = await self.repository.upsert_es_user(payload)
        if not user or not user.is_active():
            return None
        await self.repository.update_last_login(user.id)
        return user

    async def _query_token(self, token: str, strategy: str) -> Optional[Dict[str, Any]]:
        query_key = "term" if strategy == "term" else "match"
        body = {
            "query": {"bool": {"must": [{query_key: {"tokens": token}}]}},
            "size": 1,
        }
        try:
            response = await self.client.post(f"/{self.config.es_user_index}/_search", json=body)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            log.warning("es_token_query_failed strategy=%s error=%s", strategy, exc)
            return None

        hits = data.get("hits", {}).get("hits", [])
        if not hits:
            return None
        source = hits[0].get("_source") or {}
        return source if isinstance(source, dict) else None

    def _normalize_user_data(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        username = (data.get("username") or "").strip()
        if not username:
            return None
        display_name = (
            data.get("realname")
            or data.get("display_name")
            or data.get("name")
            or username
        )
        return {
            "username": username,
            "display_name": str(display_name),
            "role": UserRole.ADMIN.value if bool(data.get("is_admin")) else UserRole.USER.value,
        }

