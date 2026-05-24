"""VoiceDesign TTS endpoint: POST /v1/tts/design."""

import numpy as np
from fastapi import APIRouter, HTTPException, Response

from . import model as model_mod
from .audio import encode
from .schemas import VoiceDesignRequest


def build_router() -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.post("/tts/design")
    def tts_design(req: VoiceDesignRequest):
        if not req.text or not req.text.strip():
            raise HTTPException(status_code=400, detail="text is required")
        if not req.instruct or not req.instruct.strip():
            raise HTTPException(status_code=400, detail="instruct is required")
        sampling = req.sampling.model_dump(exclude_none=True) if req.sampling else {}
        try:
            wav, sr = model_mod.generate_design(
                text=req.text.strip(),
                instruct=req.instruct.strip(),
                language=(req.language or "Auto"),
                seed=req.seed,
                **sampling,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        body, ctype = encode(np.asarray(wav, dtype=np.float32), int(sr), req.response_format)
        return Response(content=body, media_type=ctype)

    return router
