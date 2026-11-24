"""Security guardrails for the model-facing ``/v1`` API.

The browser authentication middleware intentionally predates the REST API and
used to leave every ``/v1/*`` route public.  This module adds a small,
deployment-friendly boundary without coupling API clients to MongoDB:

* static bearer/API-key authentication, with an existing user JWT as fallback;
* fail-closed validation for non-loopback exposure;
* per-process, per-principal request limiting for costly generation routes;
* a declared request-size ceiling (upload routes also enforce a read ceiling).

The limiter is deliberately local to one process.  Production deployments
with multiple workers must enforce the same or stricter limits at the gateway.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import os
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, Iterable, Optional, Tuple

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


_TRUE = {"1", "true", "yes", "y", "on"}
_FALSE = {"0", "false", "no", "n", "off"}

# These reads are needed by the SPA, health probes, and public share pages.
# Preview generation is intentionally absent: a cache miss consumes GPU time.
PUBLIC_V1_GET_EXACT = {
    "/v1/health",
    "/v1/languages",
    "/v1/voices",
    "/v1/gallery",
}
PUBLIC_V1_GET_PREFIXES = ("/v1/share/",)

GENERATION_EXACT = {
    "/v1/tts",
    "/v1/tts/stream",
    "/v1/audio/speech",
    "/v1/tts/design",
    "/v1/clone",
    "/v1/voice/save",
    "/v1/voice/generate",
    "/v1/share/publish",
    "/v1/share/regenerate",
}


def _truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in _TRUE


def _positive_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if raw is None or raw == "":
        return default
    value = int(raw)
    if value <= 0:
        raise ValueError(f"{key} must be a positive integer")
    return value


def _tokens_from_env() -> Tuple[str, ...]:
    values = []
    single = os.environ.get("API_TOKEN", "").strip()
    if single:
        values.append(single)
    for item in os.environ.get("API_TOKENS", "").split(","):
        item = item.strip()
        if item:
            values.append(item)
    # Preserve order while removing duplicates. Never log token values, even on
    # validation failure.
    tokens = tuple(dict.fromkeys(values))
    if any(len(token) < 32 for token in tokens):
        raise RuntimeError("Every API_TOKEN/API_TOKENS entry must be at least 32 characters")
    return tokens


def is_loopback_host(host: str) -> bool:
    value = (host or "").strip().lower()
    if value in {"localhost", "127.0.0.1", "::1"}:
        return True
    try:
        return ipaddress.ip_address(value).is_loopback
    except ValueError:
        # Hostnames and wildcard/empty values are not assumed to be local.
        return False


@dataclass(frozen=True)
class ApiSecurityConfig:
    auth_mode: str = "auto"
    static_tokens: Tuple[str, ...] = ()
    auth_required: bool = False
    existing_auth_enabled: bool = False
    exposure_host: str = "127.0.0.1"
    allow_unauthenticated_public_api: bool = False
    rate_limit_per_minute: int = 20
    max_body_bytes: int = 12 * 1024 * 1024
    max_upload_bytes: int = 10 * 1024 * 1024

    @classmethod
    def from_env(
        cls,
        *,
        bind_host: str,
        existing_auth_enabled: bool,
    ) -> "ApiSecurityConfig":
        mode = (os.environ.get("API_AUTH_REQUIRED") or "auto").strip().lower()
        if mode not in _TRUE | _FALSE | {"auto"}:
            raise ValueError("API_AUTH_REQUIRED must be auto, true, or false")

        tokens = _tokens_from_env()
        exposure_host = os.environ.get("API_EXPOSURE_HOST", bind_host).strip()
        public = not is_loopback_host(exposure_host)
        allow_unsafe = _truthy(os.environ.get("ALLOW_UNAUTHENTICATED_PUBLIC_API"))

        if mode in _TRUE:
            required = True
        elif mode in _FALSE:
            required = False
        else:
            required = bool(tokens) or existing_auth_enabled or public

        has_backend = bool(tokens) or existing_auth_enabled
        if required and not has_backend:
            if public and allow_unsafe:
                required = False
            else:
                raise RuntimeError(
                    "Refusing to expose Qwen3-TTS without API authentication: "
                    "configure API_TOKEN/API_TOKENS or enable the existing JWT user "
                    "system. For an isolated development network only, an operator "
                    "may explicitly set ALLOW_UNAUTHENTICATED_PUBLIC_API=true."
                )
        if public and not required and not allow_unsafe:
            raise RuntimeError(
                "Refusing unauthenticated non-loopback exposure. Configure API_TOKEN, "
                "enable JWT auth, bind to loopback, or explicitly acknowledge the risk "
                "with ALLOW_UNAUTHENTICATED_PUBLIC_API=true."
            )

        return cls(
            auth_mode=mode,
            static_tokens=tokens,
            auth_required=required,
            existing_auth_enabled=existing_auth_enabled,
            exposure_host=exposure_host,
            allow_unauthenticated_public_api=allow_unsafe,
            rate_limit_per_minute=_positive_int("API_RATE_LIMIT_PER_MINUTE", 20),
            max_body_bytes=_positive_int("API_MAX_BODY_BYTES", 12 * 1024 * 1024),
            max_upload_bytes=_positive_int("API_MAX_UPLOAD_BYTES", 10 * 1024 * 1024),
        )


def is_public_v1_read(request: Request) -> bool:
    if request.method != "GET":
        return False
    path = request.url.path
    if path in PUBLIC_V1_GET_EXACT:
        return True
    return any(path.startswith(prefix) for prefix in PUBLIC_V1_GET_PREFIXES)


def requires_api_auth(request: Request) -> bool:
    return request.url.path.startswith("/v1/") and not is_public_v1_read(request)


def is_costly_request(request: Request) -> bool:
    path = request.url.path
    if path in GENERATION_EXACT:
        return True
    return request.method == "GET" and path.startswith("/v1/voices/") and path.endswith("/preview")


def _candidate_token(request: Request) -> Optional[str]:
    api_key = request.headers.get("x-api-key", "").strip()
    if api_key:
        return api_key
    authorization = request.headers.get("authorization", "")
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() == "bearer" and value.strip():
        return value.strip()
    return None


def _matches_any(candidate: str, expected: Iterable[str]) -> bool:
    return any(hmac.compare_digest(candidate, value) for value in expected)


def _fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


class _WindowLimiter:
    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int) -> tuple[bool, int, int]:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= 60.0:
                hits.popleft()
            if len(hits) >= limit:
                retry_after = max(1, int(60.0 - (now - hits[0])))
                return False, 0, retry_after
            hits.append(now)
            return True, max(0, limit - len(hits)), 0


class ApiSecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, config: ApiSecurityConfig):
        super().__init__(app)
        self.config = config
        self.limiter = _WindowLimiter()

    async def _authenticate(self, request: Request) -> tuple[Optional[str], Optional[dict], Optional[JSONResponse]]:
        candidate = _candidate_token(request)
        if candidate and _matches_any(candidate, self.config.static_tokens):
            return f"api:{_fingerprint(candidate)}", None, None

        state = getattr(request.app.state, "auth_state", None)
        if state is not None and state.ready_for_requests:
            jwt_token = candidate or request.cookies.get(state.config.access_cookie_name)
            if jwt_token:
                user = await state.auth_service.user_from_token(jwt_token)
                if user is not None:
                    public_user = user.to_public_dict()
                    return f"user:{public_user.get('id', 'unknown')}", public_user, None

        if state is not None and state.enabled and not state.ready_for_requests and not self.config.static_tokens:
            return None, None, JSONResponse(
                {"detail": state.error or "API authentication backend is not ready"},
                status_code=503,
            )
        return None, None, JSONResponse(
            {"detail": "API authentication required"},
            status_code=401,
            headers={"WWW-Authenticate": "Bearer"},
        )

    @staticmethod
    def _client_key(request: Request) -> str:
        # Deliberately ignore X-Forwarded-For here. A trusted ingress should rate
        # limit before forwarding; blindly trusting the header makes limits spoofable.
        host = request.client.host if request.client else "unknown"
        return f"ip:{host}"

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        is_v1 = path.startswith("/v1/")

        if is_v1 and request.method in {"POST", "PUT", "PATCH"}:
            raw_length = request.headers.get("content-length")
            if raw_length:
                try:
                    content_length = int(raw_length)
                except ValueError:
                    return JSONResponse({"detail": "invalid Content-Length"}, status_code=400)
                if content_length > self.config.max_body_bytes:
                    return JSONResponse(
                        {"detail": f"request body exceeds {self.config.max_body_bytes} bytes"},
                        status_code=413,
                    )

        principal = self._client_key(request)
        if self.config.auth_required and requires_api_auth(request):
            principal, user, error = await self._authenticate(request)
            if error is not None:
                return error
            if user is not None:
                request.state.user = user

        # Static-token-only deployments cannot safely expose the Gradio UI: it
        # calls model functions directly and cannot attach an API token. Existing
        # JWT browser auth remains the supported way to expose the UI.
        browser_bypass_path = (
            path == "/"
            or path in {"/docs", "/redoc", "/openapi.json"}
            or path.startswith("/legacy")
        )
        if (
            self.config.auth_required
            and not self.config.existing_auth_enabled
            and browser_bypass_path
        ):
            principal, _, error = await self._authenticate(request)
            if error is not None:
                return error

        remaining = None
        if is_costly_request(request):
            allowed, remaining, retry_after = self.limiter.check(
                principal or self._client_key(request),
                self.config.rate_limit_per_minute,
            )
            if not allowed:
                return JSONResponse(
                    {"detail": "rate limit exceeded"},
                    status_code=429,
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(self.config.rate_limit_per_minute),
                        "X-RateLimit-Remaining": "0",
                    },
                )

        response = await call_next(request)
        if remaining is not None:
            response.headers["X-RateLimit-Limit"] = str(self.config.rate_limit_per_minute)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response


def read_upload_limited(upload, *, limit: int, label: str) -> bytes:
    """Read at most ``limit + 1`` bytes so chunked uploads cannot bypass caps."""
    try:
        raw = upload.file.read(limit + 1)
    finally:
        try:
            upload.file.close()
        except Exception:
            pass
    if len(raw) > limit:
        from fastapi import HTTPException

        raise HTTPException(status_code=413, detail=f"{label} exceeds {limit} bytes")
    return raw


def upload_limit_from_request(request: Request) -> int:
    config = getattr(request.app.state, "api_security_config", None)
    if config is not None:
        return int(config.max_upload_bytes)
    return 10 * 1024 * 1024
