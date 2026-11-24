"""Voice-clone (Base) endpoints: /v1/clone, /v1/voice/save, /v1/voice/generate."""

import io
from typing import Optional

import numpy as np
import soundfile as sf
from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile

from . import model as model_mod
from .api_security import read_upload_limited, upload_limit_from_request
from .audio import encode
from .schemas import AudioFormat

MAX_TEXT_CHARS = 4000
MAX_REF_TEXT_CHARS = 4000
MAX_NEW_TOKENS = 4096


def _check_form_limits(*, text: Optional[str] = None, ref_text: Optional[str] = None,
                       max_new_tokens: Optional[int] = None) -> None:
    if text is not None and len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=422, detail=f"text must be ≤ {MAX_TEXT_CHARS} characters")
    if ref_text is not None and len(ref_text) > MAX_REF_TEXT_CHARS:
        raise HTTPException(status_code=422, detail=f"ref_text must be ≤ {MAX_REF_TEXT_CHARS} characters")
    if max_new_tokens is not None and not 1 <= max_new_tokens <= MAX_NEW_TOKENS:
        raise HTTPException(
            status_code=422,
            detail=f"max_new_tokens must be between 1 and {MAX_NEW_TOKENS}",
        )


def _read_upload_audio(upload: UploadFile, *, limit: int) -> tuple[np.ndarray, int]:
    """Decode an uploaded audio file into (mono_float32, sample_rate)."""
    raw = read_upload_limited(upload, limit=limit, label="ref_audio")
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
        request: Request,
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
        _check_form_limits(text=text, ref_text=ref_text, max_new_tokens=max_new_tokens)
        use_xvec = _truthy(x_vector_only)
        _check_form_limits(ref_text=ref_text)
        if not use_xvec and (not ref_text or not ref_text.strip()):
            raise HTTPException(
                status_code=400,
                detail="ref_text is required when x_vector_only is false",
            )
        wav_arr, sr = _read_upload_audio(
            ref_audio,
            limit=upload_limit_from_request(request),
        )
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

    @router.post("/voice/save")
    def voice_save(
        request: Request,
        ref_audio: UploadFile = File(...),
        ref_text: Optional[str] = Form(None),
        x_vector_only: Optional[str] = Form("false"),
    ):
        from dataclasses import asdict
        import torch
        use_xvec = _truthy(x_vector_only)
        if not use_xvec and (not ref_text or not ref_text.strip()):
            raise HTTPException(
                status_code=400,
                detail="ref_text is required when x_vector_only is false",
            )
        wav_arr, sr = _read_upload_audio(
            ref_audio,
            limit=upload_limit_from_request(request),
        )
        try:
            items = model_mod.create_clone_prompt(
                ref_audio=(wav_arr, sr),
                ref_text=(ref_text.strip() if ref_text else None),
                x_vector_only_mode=use_xvec,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        payload = {"items": [asdict(it) for it in items]}
        buf = io.BytesIO()
        torch.save(payload, buf)
        return Response(
            content=buf.getvalue(),
            media_type="application/octet-stream",
            headers={"Content-Disposition": 'attachment; filename="voice.pt"'},
        )

    @router.post("/voice/generate")
    def voice_generate(
        request: Request,
        text: str = Form(...),
        voice_prompt: UploadFile = File(...),
        language: str = Form("Auto"),
        response_format: AudioFormat = Form("wav"),
        seed: Optional[int] = Form(None),
        temperature: Optional[float] = Form(None),
        top_k: Optional[int] = Form(None),
        top_p: Optional[float] = Form(None),
        repetition_penalty: Optional[float] = Form(None),
        max_new_tokens: Optional[int] = Form(None),
    ):
        import torch
        from qwen_tts import VoiceClonePromptItem

        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="text is required")
        _check_form_limits(text=text, max_new_tokens=max_new_tokens)
        raw = read_upload_limited(
            voice_prompt,
            limit=upload_limit_from_request(request),
            label="voice_prompt",
        )
        if not raw:
            raise HTTPException(status_code=400, detail="voice_prompt is empty")
        try:
            payload = torch.load(io.BytesIO(raw), map_location="cpu", weights_only=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"could not load voice_prompt: {e}")
        if not isinstance(payload, dict) or "items" not in payload:
            raise HTTPException(status_code=400, detail="invalid voice_prompt format")
        items_raw = payload["items"]
        if not isinstance(items_raw, list) or not items_raw:
            raise HTTPException(status_code=400, detail="voice_prompt has no items")
        items = []
        for d in items_raw:
            if not isinstance(d, dict):
                raise HTTPException(status_code=400, detail="invalid item in voice_prompt")
            ref_code = d.get("ref_code")
            if ref_code is not None and not torch.is_tensor(ref_code):
                ref_code = torch.tensor(ref_code)
            ref_spk = d.get("ref_spk_embedding")
            if ref_spk is None:
                raise HTTPException(status_code=400, detail="missing ref_spk_embedding in voice_prompt")
            if not torch.is_tensor(ref_spk):
                ref_spk = torch.tensor(ref_spk)
            items.append(VoiceClonePromptItem(
                ref_code=ref_code,
                ref_spk_embedding=ref_spk,
                x_vector_only_mode=bool(d.get("x_vector_only_mode", False)),
                icl_mode=bool(d.get("icl_mode", not bool(d.get("x_vector_only_mode", False)))),
                ref_text=d.get("ref_text"),
            ))
        sampling = {
            "temperature": temperature, "top_k": top_k, "top_p": top_p,
            "repetition_penalty": repetition_penalty, "max_new_tokens": max_new_tokens,
        }
        sampling = {k: v for k, v in sampling.items() if v is not None}
        try:
            out, out_sr = model_mod.generate_clone(
                text=text.strip(),
                language=(language or "Auto"),
                voice_clone_prompt=items,
                seed=seed,
                **sampling,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        body, ctype = encode(np.asarray(out, dtype=np.float32), int(out_sr), response_format)
        return Response(content=body, media_type=ctype)

    return router
