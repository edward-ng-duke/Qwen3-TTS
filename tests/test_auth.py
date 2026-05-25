from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from qwen_tts.serve import model as model_mod
from qwen_tts.serve.app import create_app
from qwen_tts.serve.auth.config import AuthConfig
from qwen_tts.serve.auth.es_service import EsAuthService
from qwen_tts.serve.auth.models import UserDocument, UserRole, UserStatus
from qwen_tts.serve.auth.service import AuthService, hash_password_sha256
from qwen_tts.serve.auth.state import AuthState
from qwen_tts.serve.config import ServeConfig


class _FakeTTSInner:
    def get_supported_speakers(self):
        return ["Vivian"]

    def get_supported_languages(self):
        return ["Chinese"]


class _FakeWrapper:
    model = _FakeTTSInner()


class MemoryUserRepository:
    def __init__(self, users=None):
        self.users = {u.id: u for u in users or []}
        self.password_updates = []
        self.login_updates = []

    async def get_by_id(self, user_id: str):
        return self.users.get(user_id)

    async def get_by_username(self, username: str):
        for user in self.users.values():
            if user.username == username:
                return user
        return None

    async def update_last_login(self, user_id: str):
        self.login_updates.append(user_id)
        return True

    async def update_password(self, user_id: str, password_hash: str, salt: str):
        self.password_updates.append((user_id, password_hash, salt))
        user = self.users[user_id]
        user.password_hash = password_hash
        user.salt = salt
        return True

    async def upsert_es_user(self, payload):
        user = await self.get_by_username(payload["username"])
        if user is None:
            user = UserDocument(
                id=f"es-{payload['username']}",
                username=payload["username"],
                password_hash="",
                salt="",
                display_name=payload["display_name"],
                role=payload["role"],
                status=UserStatus.ACTIVE,
                auth_source="es",
                created_by="es_token",
            )
            self.users[user.id] = user
        else:
            user.display_name = payload["display_name"]
            user.role = payload["role"]
            user.auth_source = "es"
        return user


class FakeEsResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeEsClient:
    def __init__(self):
        self.calls = []

    async def post(self, url, json):
        self.calls.append((url, json))
        return FakeEsResponse({
            "hits": {
                "hits": [{
                    "_source": {
                        "username": "es_alice",
                        "realname": "ES Alice",
                        "is_admin": True,
                        "tokens": ["token-1"],
                    }
                }]
            }
        })


def _user(
    *,
    user_id="u1",
    username="alice",
    password_hash="$2b$12$invalid",
    salt="",
    status=UserStatus.ACTIVE,
    role=UserRole.USER,
):
    return UserDocument(
        id=user_id,
        username=username,
        password_hash=password_hash,
        salt=salt,
        display_name="Alice",
        role=role,
        status=status,
        auth_source="local",
    )


def _auth_state(repo: MemoryUserRepository) -> AuthState:
    config = AuthConfig(
        enabled=True,
        jwt_secret_key="test-secret",
        jwt_expire_days=7,
        es_auth_enabled=False,
    )
    return AuthState.ready(config=config, repository=repo)


@pytest.fixture
def web_dist(tmp_path, monkeypatch):
    dist = tmp_path / "web-dist"
    assets = dist / "assets"
    assets.mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><div id='root'></div>", encoding="utf-8")
    (assets / "app.js").write_text("console.log('ok')", encoding="utf-8")
    monkeypatch.setenv("WEB_DIST", str(dist))
    return dist


def _client(monkeypatch, tmp_path, web_dist, auth_state):
    monkeypatch.setattr(model_mod, "_instance", _FakeWrapper())
    cfg = ServeConfig(preview_cache_dir=str(tmp_path), model_path="/x")
    app = create_app(cfg, load_model_on_startup=False, auth_state=auth_state)
    return TestClient(app)


def test_auth_protects_browser_ui_but_leaves_v1_public(monkeypatch, tmp_path, web_dist):
    repo = MemoryUserRepository([_user()])
    state = _auth_state(repo)

    with _client(monkeypatch, tmp_path, web_dist, state) as client:
        root = client.get("/", headers={"accept": "text/html"}, follow_redirects=False)
        assert root.status_code in (307, 308)
        assert root.headers["location"] == "/login?next=/"

        assert client.get("/v1/health").status_code == 200

        token = state.auth_service.create_token(repo.users["u1"])
        client.cookies.set("access_token", token)
        authed = client.get("/", headers={"accept": "text/html"})
        assert authed.status_code == 200
        assert "<div id='root'></div>" in authed.text


def test_disabled_user_token_is_rejected(monkeypatch, tmp_path, web_dist):
    user = _user(status=UserStatus.DISABLED)
    repo = MemoryUserRepository([user])
    state = _auth_state(repo)

    with _client(monkeypatch, tmp_path, web_dist, state) as client:
        client.cookies.set("access_token", state.auth_service.create_token(user))
        r = client.get("/api/auth/me")
        assert r.status_code == 401


def test_existing_user_can_login_and_logout(monkeypatch, tmp_path, web_dist):
    password_hash = AuthService.hash_password_bcrypt("secret")
    repo = MemoryUserRepository([_user(password_hash=password_hash)])
    state = _auth_state(repo)

    with _client(monkeypatch, tmp_path, web_dist, state) as client:
        login = client.post(
            "/api/auth/login",
            json={"username": "alice", "password": "secret"},
        )
        assert login.status_code == 200
        assert login.json()["user"]["username"] == "alice"
        assert "access_token=" in login.headers["set-cookie"]
        assert repo.login_updates == ["u1"]

        logout = client.post("/api/auth/logout")
        assert logout.status_code == 200
        assert "access_token=" in logout.headers["set-cookie"]
        assert "Max-Age=0" in logout.headers["set-cookie"]


def test_auth_config_auto_enables_from_shared_mongo_and_jwt(monkeypatch):
    monkeypatch.delenv("AUTH_ENABLED", raising=False)
    monkeypatch.setenv("MONGO_URL", "mongodb://mongo:27017")
    monkeypatch.setenv("JWT_SECRET_KEY", "shared")

    config = AuthConfig.from_env()

    assert config.enabled is True
    assert config.mongo_url == "mongodb://mongo:27017"
    assert config.jwt_secret_key == "shared"


def test_enabled_auth_without_jwt_secret_fails_closed(monkeypatch, tmp_path, web_dist):
    state = AuthState(AuthConfig(enabled=True, jwt_secret_key="", es_auth_enabled=False))

    with _client(monkeypatch, tmp_path, web_dist, state) as client:
        me = client.get("/api/auth/me")
        assert me.status_code == 503
        assert "JWT_SECRET_KEY" in me.json()["detail"]


@pytest.mark.asyncio
async def test_es_token_exchange_creates_shadow_user():
    repo = MemoryUserRepository()
    config = AuthConfig(
        enabled=True,
        jwt_secret_key="test-secret",
        es_auth_enabled=True,
        es_user_index="mygpt_user",
    )
    client = FakeEsClient()
    service = EsAuthService(config, repo, client=client)

    user = await service.exchange_token("token-1")

    assert user is not None
    assert user.username == "es_alice"
    assert user.display_name == "ES Alice"
    assert user.role == UserRole.ADMIN
    assert user.auth_source == "es"
    assert client.calls[0][0] == "/mygpt_user/_search"


@pytest.mark.asyncio
async def test_legacy_sha256_password_is_migrated_on_login():
    legacy_hash = hash_password_sha256("secret", "pepper")
    user = _user(password_hash=legacy_hash, salt="pepper")
    repo = MemoryUserRepository([user])
    service = AuthService(
        AuthConfig(enabled=True, jwt_secret_key="test-secret", es_auth_enabled=False),
        repo,
    )

    token, public_user = await service.authenticate("alice", "secret")

    assert token
    assert public_user["username"] == "alice"
    assert user.password_hash.startswith("$2b$")
    assert user.salt == ""
    assert repo.password_updates[-1][0] == "u1"
