"""Voice-clone (Base) endpoints: /v1/clone, /v1/voice/save, /v1/voice/generate."""

import io
from typing import Optional

import numpy as np
import soundfile as sf
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from . import model as model_mod
from .audio import encode
from .schemas import AudioFormat


def _read_upload_audio(upload: UploadFile) -> tuple[np.ndarray, int]:
    """Decode an uploaded audio file into (mono_float32, sample_rate)."""
    try:
        raw = upload.file.read()
    finally:
        try: upload.file.close()
        except Exception: pass
    if not raw:
        raise HTTPException(status_code=400, detail="ref_audio file is empty")
    try:
        wav, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"could not decode ref_audio: {e}")
    if wav.ndim > 1:
        wav = wav.mean(axis=-1).astype(np.float32)
    return wav.astype(np.float32), int(sr)


def _truthy(s: Optional[str]) -> bool:
    return (s or "").strip().lower() in ("1", "true", "yes", "y", "on")


def build_router() -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.post("/clone")
    def clone(
        text: str = Form(...),
        ref_audio: UploadFile = File(...),
        language: str = Form("Auto"),
        ref_text: Optional[str] = Form(None),
        x_vector_only: Optional[str] = Form("false"),
        response_format: AudioFormat = Form("wav"),
        seed: Optional[int] = Form(None),
        temperature: Optional[float] = Form(None),
        top_k: Optional[int] = Form(None),
        top_p: Optional[float] = Form(None),
        repetition_penalty: Optional[float] = Form(None),
        max_new_tokens: Optional[int] = Form(None),
    ):
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="text is required")
        use_xvec = _truthy(x_vector_only)
        if not use_xvec and (not ref_text or not ref_text.strip()):
            raise HTTPException(
                status_code=400,
                detail="ref_text is required when x_vector_only is false",
            )
        wav_arr, sr = _read_upload_audio(ref_audio)
        sampling = {
            "temperature": temperature, "top_k": top_k, "top_p": top_p,
            "repetition_penalty": repetition_penalty, "max_new_tokens": max_new_tokens,
        }
        sampling = {k: v for k, v in sampling.items() if v is not None}
        try:
            out, out_sr = model_mod.generate_clone(
                text=text.strip(),
                language=(language or "Auto"),
                ref_audio=(wav_arr, sr),
                ref_text=(ref_text.strip() if ref_text else None),
                x_vector_only_mode=use_xvec,
                seed=seed,
                **sampling,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        body, ctype = encode(np.asarray(out, dtype=np.float32), int(out_sr), response_format)
        return Response(content=body, media_type=ctype)

    return router
