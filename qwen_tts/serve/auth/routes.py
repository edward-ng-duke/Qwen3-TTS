from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from .middleware import extract_jwt_token


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


def _state(request: Request):
    state = getattr(request.app.state, "auth_state", None)
    if state is None or not state.enabled:
        raise HTTPException(status_code=404, detail="auth is not enabled")
    if not state.ready_for_requests:
        raise HTTPException(status_code=503, detail=state.error or "auth storage unavailable")
    return state


def _enabled_state(request: Request):
    state = getattr(request.app.state, "auth_state", None)
    if state is None or not state.enabled:
        raise HTTPException(status_code=404, detail="auth is not enabled")
    return state


def _set_access_cookie(response: Response, state, token: str) -> None:
    response.set_cookie(
        state.config.access_cookie_name,
        token,
        max_age=state.config.jwt_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=state.config.cookie_secure,
        samesite="lax",
        path="/",
    )


def build_router() -> APIRouter:
    router = APIRouter(prefix="/api/auth", tags=["auth"])

    @router.get("/me")
    async def me(request: Request):
        state = _state(request)
        token = extract_jwt_token(request, state.config.access_cookie_name)
        if not token:
            raise HTTPException(status_code=401, detail="not authenticated")
        user = await state.auth_service.user_from_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="not authenticated")
        return {"user": user.to_public_dict()}

    @router.post("/login")
    async def login(payload: LoginRequest, request: Request, response: Response):
        state = _state(request)
        token, user = await state.auth_service.authenticate(
            payload.username.strip(),
            payload.password,
            remember_me=payload.remember_me,
        )
        if not token or not user:
            raise HTTPException(status_code=401, detail="invalid username or password")
        _set_access_cookie(response, state, token)
        return {"access_token": token, "user": user}

    @router.post("/logout")
    async def logout(request: Request, response: Response):
        state = _enabled_state(request)
        response.delete_cookie(state.config.access_cookie_name, path="/")
        return {"ok": True}

    @router.post("/verify-es-token")
    async def verify_es_token(request: Request, response: Response):
        state = _state(request)
        if not state.es_auth_service:
            raise HTTPException(status_code=503, detail="ES auth is not enabled")
        user = await state.es_auth_service.exchange_request(request)
        if not user:
            raise HTTPException(status_code=401, detail="invalid ES token")
        token = state.auth_service.create_token(user)
        _set_access_cookie(response, state, token)
        return {"access_token": token, "user": user.to_public_dict()}

    return router
