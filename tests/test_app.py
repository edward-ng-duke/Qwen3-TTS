from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from qwen_tts.serve import model as model_mod
from qwen_tts.serve.app import create_app
from qwen_tts.serve.config import ServeConfig


class _FakeTTSInner:
    def get_supported_speakers(self):
        return ["Vivian", "Ryan"]

    def get_supported_languages(self):
        return ["Chinese", "English"]


class _FakeWrapper:
    model = _FakeTTSInner()


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Pretend the model is already loaded so startup doesn't try to.
    monkeypatch.setattr(model_mod, "_instance", _FakeWrapper())
    cfg = ServeConfig(
        preview_cache_dir=str(tmp_path),
        model_path="/x",
    )
    app = create_app(cfg, load_model_on_startup=False)
    with TestClient(app) as c:
        yield c
    monkeypatch.setattr(model_mod, "_instance", None)


def test_health(client):
    r = client.get("/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["model_ready"] is True
    assert body["model_path"] == "/x"


def test_voices(client):
    r = client.get("/v1/voices")
    assert r.status_code == 200
    ids = [v["id"] for v in r.json()["voices"]]
    assert "vivian" in ids and "ryan" in ids


def test_languages(client):
    r = client.get("/v1/languages")
    assert r.status_code == 200
    langs = r.json()["languages"]
    assert langs[0] == "Auto"


def test_root_returns_gradio(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.text.lower()
    assert "gradio" in body or "<!doctype html" in body
