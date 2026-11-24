from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from qwen_tts.serve.api_security import ApiSecurityConfig, ApiSecurityMiddleware

TEST_API_TOKEN = "test-api-secret-that-is-at-least-32-characters"


def _clear_security_env(monkeypatch):
    for key in (
        "API_TOKEN",
        "API_TOKENS",
        "API_AUTH_REQUIRED",
        "API_EXPOSURE_HOST",
        "ALLOW_UNAUTHENTICATED_PUBLIC_API",
        "API_RATE_LIMIT_PER_MINUTE",
        "API_MAX_BODY_BYTES",
        "API_MAX_UPLOAD_BYTES",
    ):
        monkeypatch.delenv(key, raising=False)


def _client(config: ApiSecurityConfig) -> TestClient:
    app = FastAPI()
    app.state.api_security_config = config
    app.add_middleware(ApiSecurityMiddleware, config=config)

    @app.get("/v1/health")
    def health():
        return {"status": "ok"}

    @app.post("/v1/tts")
    def tts():
        return {"ok": True}

    @app.get("/legacy/")
    def legacy():
        return {"unsafe_direct_ui": True}

    return TestClient(app)


def test_non_loopback_without_auth_fails_closed(monkeypatch):
    _clear_security_env(monkeypatch)
    with pytest.raises(RuntimeError, match="Refusing to expose"):
        ApiSecurityConfig.from_env(bind_host="0.0.0.0", existing_auth_enabled=False)


def test_loopback_auto_keeps_local_development_compatible(monkeypatch):
    _clear_security_env(monkeypatch)
    config = ApiSecurityConfig.from_env(
        bind_host="127.0.0.1",
        existing_auth_enabled=False,
    )
    assert config.auth_required is False
    assert _client(config).post("/v1/tts").status_code == 200


def test_static_token_protects_generation_but_not_health(monkeypatch):
    _clear_security_env(monkeypatch)
    monkeypatch.setenv("API_TOKEN", TEST_API_TOKEN)
    config = ApiSecurityConfig.from_env(
        bind_host="0.0.0.0",
        existing_auth_enabled=False,
    )
    client = _client(config)

    assert client.get("/v1/health").status_code == 200
    assert client.post("/v1/tts").status_code == 401
    assert client.post(
        "/v1/tts",
        headers={"Authorization": f"Bearer {TEST_API_TOKEN}"},
    ).status_code == 200
    assert client.post(
        "/v1/tts",
        headers={"X-API-Key": TEST_API_TOKEN},
    ).status_code == 200


def test_static_token_only_blocks_direct_gradio_bypass(monkeypatch):
    _clear_security_env(monkeypatch)
    monkeypatch.setenv("API_TOKEN", TEST_API_TOKEN)
    config = ApiSecurityConfig.from_env(
        bind_host="0.0.0.0",
        existing_auth_enabled=False,
    )
    client = _client(config)

    assert client.get("/legacy/").status_code == 401
    assert client.get(
        "/legacy/",
        headers={"Authorization": f"Bearer {TEST_API_TOKEN}"},
    ).status_code == 200


def test_weak_static_token_fails_closed_without_echoing_secret(monkeypatch):
    _clear_security_env(monkeypatch)
    weak = "short-secret"
    monkeypatch.setenv("API_TOKEN", weak)

    with pytest.raises(RuntimeError) as exc_info:
        ApiSecurityConfig.from_env(
            bind_host="127.0.0.1",
            existing_auth_enabled=False,
        )

    assert "at least 32 characters" in str(exc_info.value)
    assert weak not in str(exc_info.value)


def test_declared_body_size_limit(monkeypatch):
    _clear_security_env(monkeypatch)
    config = ApiSecurityConfig(max_body_bytes=8)
    response = _client(config).post(
        "/v1/tts",
        content=b"123456789",
        headers={"Content-Type": "application/octet-stream"},
    )
    assert response.status_code == 413


def test_generation_rate_limit(monkeypatch):
    _clear_security_env(monkeypatch)
    config = ApiSecurityConfig(rate_limit_per_minute=2)
    client = _client(config)

    assert client.post("/v1/tts").status_code == 200
    assert client.post("/v1/tts").status_code == 200
    limited = client.post("/v1/tts")
    assert limited.status_code == 429
    assert limited.headers["x-ratelimit-remaining"] == "0"


def test_public_unsafe_override_is_explicit(monkeypatch):
    _clear_security_env(monkeypatch)
    monkeypatch.setenv("ALLOW_UNAUTHENTICATED_PUBLIC_API", "true")
    config = ApiSecurityConfig.from_env(
        bind_host="0.0.0.0",
        existing_auth_enabled=False,
    )
    assert config.auth_required is False
    assert config.allow_unauthenticated_public_api is True
