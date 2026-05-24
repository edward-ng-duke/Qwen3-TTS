"""Native (full-feature) TTS endpoints: POST /v1/tts and POST /v1/tts/stream."""

import numpy as np
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse

from . import model as model_mod
from .audio import encode, encode_pcm
from .schemas import NativeStreamRequest, NativeTTSRequest


def _gen_one(req: NativeTTSRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    if not req.speaker or not req.speaker.strip():
        raise HTTPException(status_code=400, detail="speaker is required")
    sampling = req.sampling.model_dump(exclude_none=True) if req.sampling else {}
    try:
        wav, sr = model_mod.generate(
            text=req.text,
            speaker=req.speaker,
            language=(req.language or "Auto"),
            instruct=req.instruct,
            seed=req.seed,
            **sampling,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return np.asarray(wav, dtype=np.float32), int(sr)


def build_router() -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.post("/tts")
    def tts(req: NativeTTSRequest):
        wav, sr = _gen_one(req)
        body, ctype = encode(wav, sr, req.response_format)
        return Response(content=body, media_type=ctype)

    @router.post("/tts/stream")
    def tts_stream(req: NativeStreamRequest):
        """Pseudo-streaming: produce the full waveform, then emit it as
        chunk_ms-sized raw PCM frames over chunked transfer.
        True token-level streaming is left as future work."""
        wav, sr = _gen_one(req)
        chunk_samples = max(1, int(sr * (req.chunk_ms or 200) / 1000))

        def iter_chunks():
            for i in range(0, len(wav), chunk_samples):
                seg = wav[i : i + chunk_samples]
                yield encode_pcm(seg, sr)

        ctype = f"audio/L16; rate={sr}; channels=1"
        return StreamingResponse(iter_chunks(), media_type=ctype)

    return router
