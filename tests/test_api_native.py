import io

import numpy as np
import pytest
import soundfile as sf
from fastapi import FastAPI
from fastapi.testclient import TestClient

from qwen_tts.serve import model as model_mod
from qwen_tts.serve.api_native import build_router


def _stub_generate(*, text, speaker, language="Auto", instruct=None, seed=None, **sampling):
    sr = 24000
    # 0.5s of mild signal
    t = np.linspace(0, 0.5, sr // 2, endpoint=False, dtype=np.float32)
    return (0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32), sr


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(model_mod, "generate", _stub_generate)
    app = FastAPI()
    app.include_router(build_router())
    yield TestClient(app)


def test_native_wav(client):
    r = client.post("/v1/tts",
                    json={"text": "hi", "speaker": "Vivian", "language": "Chinese",
                          "response_format": "wav"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("audio/wav")
    data, sr = sf.read(io.BytesIO(r.content), dtype="float32")
    assert sr == 24000


def test_native_pcm_ctype(client):
    r = client.post("/v1/tts",
                    json={"text": "hi", "speaker": "Vivian", "response_format": "pcm"})
    assert r.status_code == 200
    assert "audio/L16" in r.headers["content-type"]
    assert len(r.content) == 24000 * 0.5 * 2  # 0.5s int16 mono


def test_native_missing_text_400(client):
    r = client.post("/v1/tts", json={"text": "", "speaker": "Vivian"})
    assert r.status_code == 400


def test_native_with_sampling(client):
    r = client.post("/v1/tts",
                    json={"text": "hi", "speaker": "Ryan", "language": "English",
                          "instruct": "happy",
                          "sampling": {"temperature": 0.7, "top_k": 40, "top_p": 0.95},
                          "seed": 7})
    assert r.status_code == 200


def test_stream_total_bytes(client):
    """Stream sums to len(wav) * 2 bytes (int16)."""
    # chunk_ms=100 → 100ms * 24000/1000 = 2400 samples * 2 bytes = 4800 bytes per chunk
    chunk_size = int(24000 * 100 / 1000) * 2  # 4800 bytes
    with client.stream("POST", "/v1/tts/stream",
                       json={"text": "hi", "speaker": "Vivian",
                             "response_format": "pcm", "chunk_ms": 100}) as r:
        assert r.status_code == 200
        assert "audio/L16" in r.headers["content-type"]
        total = 0
        chunks = 0
        for chunk in r.iter_bytes(chunk_size=chunk_size):
            total += len(chunk)
            if chunk:
                chunks += 1
    expected = 24000 * 0.5 * 2  # 0.5s int16 mono
    assert total == expected
    assert chunks >= 4  # 100ms chunks across 500ms = ~5 chunks
