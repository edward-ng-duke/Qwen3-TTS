from urllib.parse import quote

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, RedirectResponse


STATIC_EXTENSIONS = {
    ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".webp", ".avif", ".woff", ".woff2", ".ttf", ".map",
}
PUBLIC_EXACT = {"/login", "/favicon.ico", "/favicon.svg"}
PUBLIC_PREFIXES = ("/v1", "/api/auth", "/assets")
PROTECTED_EXACT = {"/", "/docs", "/redoc", "/openapi.json"}
PROTECTED_PREFIXES = ("/legacy",)


def extract_jwt_token(request: Request, cookie_name: str = "access_token"):
    token = request.cookies.get(cookie_name)
    if token:
        return token
    auth_header = request.headers.get("authorization", "")
    scheme, _, value = auth_header.partition(" ")
    if scheme.lower() == "bearer" and value:
        return value.strip()
    return None


def is_public_path(path: str) -> bool:
    if path in PUBLIC_EXACT:
        return True
    if any(path.startswith(prefix) for prefix in PUBLIC_PREFIXES):
        return True
    return any(path.endswith(ext) for ext in STATIC_EXTENSIONS)


def requires_auth(path: str) -> bool:
    if is_public_path(path):
        return False
    if path in PROTECTED_EXACT:
        return True
    if any(path.startswith(prefix) for prefix in PROTECTED_PREFIXES):
        return True
    # React router fallback paths should not expose the app shell anonymously.
    return not path.startswith("/api/")


def wants_html(request: Request) -> bool:
    accept = request.headers.get("accept", "")
    return "text/html" in accept


def safe_next_path(request: Request) -> str:
    path = request.url.path or "/"
    if not path.startswith("/") or path.startswith("//"):
        path = "/"
    if request.url.query:
        path = f"{path}?{request.url.query}"
    return path


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        state = getattr(request.app.state, "auth_state", None)
        if state is None or not state.enabled or not requires_auth(request.url.path):
            return await call_next(request)

        if state.ready_for_requests:
            token = extract_jwt_token(request, state.config.access_cookie_name)
            if token:
                user = await state.auth_service.user_from_token(token)
                if user is not None:
                    request.state.user = user.to_public_dict()
                    return await call_next(request)

        if wants_html(request):
            next_path = quote(safe_next_path(request), safe="/?=&")
            return RedirectResponse(f"/login?next={next_path}", status_code=307)

        status = 503 if state.error else 401
        detail = state.error or "authentication required"
        return JSONResponse({"detail": detail}, status_code=status)

