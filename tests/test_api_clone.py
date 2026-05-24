import io

import numpy as np
import soundfile as sf
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from qwen_tts.serve import model as model_mod
from qwen_tts.serve.api_clone import build_router


def _stub_clone(*, text, language="Auto", ref_audio=None, ref_text=None,
                x_vector_only_mode=False, voice_clone_prompt=None,
                seed=None, **sampling):
    sr = 24000
    t = np.linspace(0, 0.5, sr // 2, endpoint=False, dtype=np.float32)
    return (0.25 * np.sin(2 * np.pi * 440 * t)).astype(np.float32), sr


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(model_mod, "generate_clone", _stub_clone)
    app = FastAPI()
    app.include_router(build_router())
    yield TestClient(app)


def _make_wav_bytes(sr=16000, dur=1.0) -> bytes:
    t = np.linspace(0, dur, int(sr * dur), endpoint=False, dtype=np.float32)
    wav = (0.1 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, wav, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def test_clone_minimal(client):
    audio_bytes = _make_wav_bytes()
    r = client.post(
        "/v1/clone",
        data={
            "text": "Hello cloned voice.",
            "language": "English",
            "ref_text": "reference text",
            "x_vector_only": "false",
            "response_format": "wav",
        },
        files={"ref_audio": ("ref.wav", audio_bytes, "audio/wav")},
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("audio/wav")


def test_clone_xvec_only(client):
    audio_bytes = _make_wav_bytes()
    r = client.post(
        "/v1/clone",
        data={"text": "hi", "x_vector_only": "true"},
        files={"ref_audio": ("ref.wav", audio_bytes, "audio/wav")},
    )
    assert r.status_code == 200


def test_clone_missing_audio(client):
    r = client.post("/v1/clone", data={"text": "hi", "ref_text": "x"})
    assert r.status_code in (400, 422)


def test_clone_missing_text(client):
    audio_bytes = _make_wav_bytes()
    r = client.post(
        "/v1/clone",
        data={"text": "", "ref_text": "x"},
        files={"ref_audio": ("ref.wav", audio_bytes, "audio/wav")},
    )
    assert r.status_code == 400


def test_clone_requires_ref_text_when_not_xvec(client):
    audio_bytes = _make_wav_bytes()
    r = client.post(
        "/v1/clone",
        data={"text": "hi", "x_vector_only": "false"},
        files={"ref_audio": ("ref.wav", audio_bytes, "audio/wav")},
    )
    assert r.status_code == 400
