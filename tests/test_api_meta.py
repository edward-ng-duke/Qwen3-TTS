import io
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
import soundfile as sf
from fastapi import FastAPI
from fastapi.testclient import TestClient

from qwen_tts.serve import model as model_mod
from qwen_tts.serve import previews as previews_mod
from qwen_tts.serve.api_meta import build_router
from qwen_tts.serve.config import ServeConfig


class _FakeTTSModel:
    def get_supported_speakers(self):
        return ["Vivian", "Ryan", "MysteryVoice"]

    def get_supported_languages(self):
        return ["Chinese", "English", "Japanese"]


class _FakeWrapper:
    """Mimics Qwen3TTSModel wrapper: has a `.model` with the methods."""
    model = _FakeTTSModel()


def _stub_generate(*, text, speaker, language="Auto", instruct=None, **_):
    sr = 24000
    return np.zeros(sr // 2, dtype=np.float32), sr


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Seed singleton with a fake model + stub preview generator.
    monkeypatch.setattr(model_mod, "_instance", _FakeWrapper())
    monkeypatch.setattr(previews_mod, "generate", _stub_generate)
    cfg = ServeConfig(preview_cache_dir=str(tmp_path), model_path="/x")
    app = FastAPI()
    app.include_router(build_router(cfg))
    yield TestClient(app)
    monkeypatch.setattr(model_mod, "_instance", None)


def test_health_ok(client):
    r = client.get("/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["model_ready"] is True
    assert body["status"] == "ok"
    assert body["model_path"] == "/x"


def test_list_voices(client):
    r = client.get("/v1/voices")
    assert r.status_code == 200
    body = r.json()
    ids = [v["id"] for v in body["voices"]]
    assert "vivian" in ids
    assert "ryan" in ids
    assert "mysteryvoice" in ids  # synthesized record
    for v in body["voices"]:
        assert v["preview_url"] == f"/v1/voices/{v['id']}/preview"


def test_list_languages_includes_auto(client):
    r = client.get("/v1/languages")
    assert r.status_code == 200
    langs = r.json()["languages"]
    assert langs[0] == "Auto"
    assert "Chinese" in langs


def test_get_preview_generates_and_returns_wav(client, tmp_path):
    r = client.get("/v1/voices/vivian/preview")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("audio/wav")
    # Sanity: body parses as wav
    data, sr = sf.read(io.BytesIO(r.content), dtype="float32")
    assert sr == 24000


def test_get_preview_unknown_404(client):
    r = client.get("/v1/voices/no_such_voice/preview")
    assert r.status_code == 404


def test_voices_404_when_variant_not_customvoice(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient
    from qwen_tts.serve import model as model_mod
    from qwen_tts.serve.api_meta import build_router
    from qwen_tts.serve.config import ServeConfig
    from fastapi import FastAPI

    class _Fake:
        class model:
            @staticmethod
            def get_supported_speakers(): return []
            @staticmethod
            def get_supported_languages(): return []
    monkeypatch.setattr(model_mod, "_instance", _Fake())
    cfg = ServeConfig(variant="voicedesign", model_path="/x",
                      preview_cache_dir=str(tmp_path))
    app = FastAPI()
    app.include_router(build_router(cfg))
    c = TestClient(app)
    assert c.get("/v1/voices").status_code == 404
    assert c.get("/v1/voices/vivian/preview").status_code == 404
    assert c.get("/v1/health").json()["variant"] == "voicedesign"
    monkeypatch.setattr(model_mod, "_instance", None)
