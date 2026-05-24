import io

import numpy as np
import soundfile as sf
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from qwen_tts.serve import model as model_mod
from qwen_tts.serve.api_design import build_router


def _stub_design(*, text, instruct, language="Auto", seed=None, **sampling):
    sr = 24000
    t = np.linspace(0, 0.5, sr // 2, endpoint=False, dtype=np.float32)
    return (0.2 * np.sin(2 * np.pi * 330 * t)).astype(np.float32), sr


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(model_mod, "generate_design", _stub_design)
    app = FastAPI()
    app.include_router(build_router())
    yield TestClient(app)


def test_design_wav(client):
    r = client.post("/v1/tts/design", json={
        "text": "Hello there.",
        "instruct": "Speak with an incredulous tone.",
        "language": "English",
        "response_format": "wav",
    })
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("audio/wav")
    data, sr = sf.read(io.BytesIO(r.content), dtype="float32")
    assert sr == 24000
    assert len(data) > 0


def test_design_missing_text(client):
    r = client.post("/v1/tts/design", json={"text": "", "instruct": "calm"})
    assert r.status_code == 400


def test_design_missing_instruct(client):
    r = client.post("/v1/tts/design", json={"text": "hi", "instruct": ""})
    assert r.status_code == 400


def test_design_with_sampling(client):
    r = client.post("/v1/tts/design", json={
        "text": "hi",
        "instruct": "happy",
        "sampling": {"temperature": 0.6, "top_k": 30},
        "seed": 7,
    })
    assert r.status_code == 200
