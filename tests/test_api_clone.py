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


def test_voice_save_returns_pt(client, monkeypatch):
    # Stub create_clone_prompt to return a single item resembling VoiceClonePromptItem.
    from qwen_tts import VoiceClonePromptItem
    import torch
    def _stub_create_prompt(*, ref_audio, ref_text, x_vector_only_mode):
        return [VoiceClonePromptItem(
            ref_code=torch.zeros(4, dtype=torch.long),
            ref_spk_embedding=torch.zeros(192, dtype=torch.float32),
            x_vector_only_mode=x_vector_only_mode,
            icl_mode=not x_vector_only_mode,
            ref_text=ref_text,
        )]
    monkeypatch.setattr(model_mod, "create_clone_prompt", _stub_create_prompt)

    audio_bytes = _make_wav_bytes()
    r = client.post(
        "/v1/voice/save",
        data={"ref_text": "reference text", "x_vector_only": "false"},
        files={"ref_audio": ("ref.wav", audio_bytes, "audio/wav")},
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/octet-stream")
    # Round-trip: should be a torch save blob loadable with weights_only=True.
    payload = torch.load(io.BytesIO(r.content), map_location="cpu", weights_only=True)
    assert isinstance(payload, dict) and "items" in payload
    assert len(payload["items"]) == 1


def test_voice_generate_with_loaded_prompt(client, monkeypatch):
    import torch
    from dataclasses import asdict
    from qwen_tts import VoiceClonePromptItem

    captured = {}

    def _stub_clone_with_prompt(*, text, language="Auto", voice_clone_prompt=None,
                                ref_audio=None, ref_text=None,
                                x_vector_only_mode=False, seed=None, **sampling):
        captured["voice_clone_prompt"] = voice_clone_prompt
        sr = 24000
        return np.zeros(sr, dtype=np.float32), sr

    monkeypatch.setattr(model_mod, "generate_clone", _stub_clone_with_prompt)

    item = VoiceClonePromptItem(
        ref_code=torch.zeros(4, dtype=torch.long),
        ref_spk_embedding=torch.zeros(192, dtype=torch.float32),
        x_vector_only_mode=False,
        icl_mode=True,
        ref_text="ref",
    )
    payload = {"items": [asdict(item)]}
    buf = io.BytesIO()
    torch.save(payload, buf)
    pt_bytes = buf.getvalue()

    r = client.post(
        "/v1/voice/generate",
        data={"text": "hello with loaded voice", "language": "English",
              "response_format": "wav"},
        files={"voice_prompt": ("voice.pt", pt_bytes, "application/octet-stream")},
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("audio/wav")
    assert captured["voice_clone_prompt"] is not None
    assert len(captured["voice_clone_prompt"]) == 1


def test_voice_generate_missing_prompt(client):
    r = client.post(
        "/v1/voice/generate",
        data={"text": "hi"},
    )
    assert r.status_code in (400, 422)


def test_voice_generate_malformed_prompt(client):
    r = client.post(
        "/v1/voice/generate",
        data={"text": "hi"},
        files={"voice_prompt": ("voice.pt", b"not a real torch file", "application/octet-stream")},
    )
    assert r.status_code == 400
