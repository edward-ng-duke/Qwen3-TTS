"""OpenAI-compatible TTS endpoint: POST /v1/audio/speech."""

from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Response

from . import model as model_mod
from .audio import encode
from .schemas import OpenAISpeechRequest
from .voices import SPEAKER_METADATA


def _resolve_voice(voice: str) -> str:
    """Map an OpenAI-style voice name (case-insensitive) to a display name the
    underlying model accepts. Falls back to the user-supplied value title-cased
    if no metadata match — the model layer will then raise if it's truly unknown."""
    if not voice:
        raise HTTPException(status_code=400, detail="voice is required")
    sid = voice.lower()
    info = SPEAKER_METADATA.get(sid)
    if info is not None:
        return info.display_name
    return voice if not voice.islower() else voice.title()


def _apply_speed(wav: np.ndarray, speed: float) -> np.ndarray:
    if speed is None or abs(speed - 1.0) < 1e-3:
        return wav
    if speed <= 0:
        raise HTTPException(status_code=400, detail="speed must be > 0")
    try:
        import librosa
        out = librosa.effects.time_stretch(y=wav.astype(np.float32), rate=float(speed))
        return out.astype(np.float32)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"time_stretch failed: {e}")


def build_router() -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.post("/audio/speech")
    def audio_speech(req: OpenAISpeechRequest):
        if not req.input or not req.input.strip():
            raise HTTPException(status_code=400, detail="input is required")
        speaker = _resolve_voice(req.voice)
        try:
            wav, sr = model_mod.generate(
                text=req.input,
                speaker=speaker,
                language="Auto",
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        wav = _apply_speed(np.asarray(wav, dtype=np.float32), req.speed or 1.0)
        body, ctype = encode(wav, sr, req.response_format)
        return Response(content=body, media_type=ctype)

    return router
