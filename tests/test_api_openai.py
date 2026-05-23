import io

import numpy as np
import pytest
import soundfile as sf
from fastapi import FastAPI
from fastapi.testclient import TestClient

from qwen_tts.serve import model as model_mod
from qwen_tts.serve.api_openai import build_router


def _stub_generate(*, text, speaker, language="Auto", instruct=None, **_):
    sr = 24000
    # 1s tone-like waveform so time-stretch has something to chew on
    t = np.linspace(0, 1.0, sr, endpoint=False, dtype=np.float32)
    return (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32), sr


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(model_mod, "generate", _stub_generate)
    app = FastAPI()
    app.include_router(build_router())
    yield TestClient(app)


def test_wav_response(client):
    r = client.post("/v1/audio/speech",
                    json={"model": "qwen3-tts", "input": "hi", "voice": "Vivian"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("audio/wav")
    data, sr = sf.read(io.BytesIO(r.content), dtype="float32")
    assert sr == 24000


def test_flac_response(client):
    r = client.post("/v1/audio/speech",
                    json={"model": "qwen3-tts", "input": "hi", "voice": "Vivian",
                          "response_format": "flac"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("audio/flac")


def test_pcm_response(client):
    r = client.post("/v1/audio/speech",
                    json={"model": "qwen3-tts", "input": "hi", "voice": "Vivian",
                          "response_format": "pcm"})
    assert r.status_code == 200
    assert "audio/L16" in r.headers["content-type"]


def test_unknown_format_422(client):
    r = client.post("/v1/audio/speech",
                    json={"model": "qwen3-tts", "input": "hi", "voice": "V",
                          "response_format": "ogg"})
    assert r.status_code == 422  # pydantic Literal violation


def test_empty_input_400(client):
    r = client.post("/v1/audio/speech",
                    json={"model": "x", "input": "  ", "voice": "Vivian"})
    assert r.status_code == 400


def test_voice_case_insensitive(client):
    r = client.post("/v1/audio/speech",
                    json={"model": "x", "input": "hi", "voice": "VIVIAN"})
    assert r.status_code == 200


def test_speed_changes_length(client):
    r1 = client.post("/v1/audio/speech",
                     json={"model": "x", "input": "hi", "voice": "Vivian", "speed": 1.0})
    r2 = client.post("/v1/audio/speech",
                     json={"model": "x", "input": "hi", "voice": "Vivian", "speed": 2.0})
    assert r1.status_code == 200 and r2.status_code == 200
    d1, _ = sf.read(io.BytesIO(r1.content), dtype="float32")
    d2, _ = sf.read(io.BytesIO(r2.content), dtype="float32")
    # speed=2.0 should yield roughly half-length
    assert d2.shape[0] < d1.shape[0]
