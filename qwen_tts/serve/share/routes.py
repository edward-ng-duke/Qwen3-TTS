import base64
import time
from typing import Deque, Dict

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from .. import model as model_mod
from ..audio import encode_wav
from .models import (
    PublishMetadata,
    PublishResponse,
    GalleryResponse,
    RegenerateRequest,
    RegenerateResponse,
    RegenerateVariantOut,
    ShareWorkOut,
    VALID_DIMENSIONS,
    work_to_out,
)

def _state(request: Request):
    state = getattr(request.app.state, "share_state", None)
    if state is None or not state.enabled:
        raise HTTPException(status_code=404, detail="sharing is not enabled")
    if not state.ready_for_requests:
        raise HTTPException(status_code=503, detail=state.error or "share storage unavailable")
    return state


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limited(hits_by_ip: Dict[str, Deque[float]], ip: str, limit_per_min: int) -> bool:
    now = time.monotonic()
    hits = hits_by_ip[ip]
    while hits and now - hits[0] > 60.0:
        hits.popleft()
    if len(hits) >= limit_per_min:
        return True
    hits.append(now)
    return False


def build_router() -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["share"])

    @router.post("/share/publish", response_model=PublishResponse)
    async def publish(request: Request):
        state = _state(request)
        form = await request.form()
        raw_meta = form.get("metadata")
        if not raw_meta or not isinstance(raw_meta, str):
            raise HTTPException(status_code=422, detail="metadata (JSON string) is required")
        try:
            meta = PublishMetadata.model_validate_json(raw_meta)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"invalid metadata: {exc}")
        if meta.dimension not in VALID_DIMENSIONS:
            raise HTTPException(
                status_code=422,
                detail=f"dimension must be one of {VALID_DIMENSIONS}",
            )

        audio_by_variant: Dict[str, bytes] = {}
        for v in meta.variants:
            upload = form.get(f"audio_{v.id}")
            if upload is None or not hasattr(upload, "read"):
                raise HTTPException(status_code=422, detail=f"missing audio for variant {v.id}")
            audio_by_variant[v.id] = await upload.read()

        created_by = None
        user = getattr(request.state, "user", None)
        if isinstance(user, dict):
            created_by = user.get("id") or user.get("username")

        try:
            slug = await state.store.create_work(
                meta, audio_by_variant, kind="user", created_by=created_by
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        return PublishResponse(slug=slug, url=f"/share/{slug}")

    @router.get("/gallery", response_model=GalleryResponse)
    async def gallery(request: Request):
        state = _state(request)
        docs = await state.store.list_gallery()
        return GalleryResponse(items=[work_to_out(d) for d in docs])

    @router.get("/share/{slug}", response_model=ShareWorkOut)
    async def get_share(slug: str, request: Request):
        state = _state(request)
        doc = await state.store.get_work(slug)
        if not doc:
            raise HTTPException(status_code=404, detail="not found")
        return work_to_out(doc)

    @router.get("/share/{slug}/audio/{variant_id}")
    async def get_share_audio(slug: str, variant_id: str, request: Request):
        state = _state(request)
        path = state.store.audio_file(slug, variant_id)
        if path is None:
            raise HTTPException(status_code=404, detail="audio not found")
        # FileResponse honors Range requests → waveform seek/scrub works.
        return FileResponse(str(path), media_type="audio/wav", filename=f"{slug}-{variant_id}.wav")

    @router.post("/share/regenerate", response_model=RegenerateResponse)
    async def regenerate(req: RegenerateRequest, request: Request):
        state = _state(request)
        text = req.new_text.strip()
        if not text:
            raise HTTPException(status_code=422, detail="new_text is required")
        if len(text) > state.config.regen_max_chars:
            raise HTTPException(
                status_code=422,
                detail=f"new_text must be ≤ {state.config.regen_max_chars} characters",
            )
        if _rate_limited(state.regen_hits, _client_ip(request), state.config.regen_rate_per_min):
            raise HTTPException(status_code=429, detail="too many requests, try again shortly")

        doc = await state.store.get_work(req.source_slug)
        if not doc:
            raise HTTPException(status_code=404, detail="source not found")
        if not model_mod.is_ready():
            raise HTTPException(status_code=503, detail="model not ready")

        out_variants = []
        for v in doc.get("variants", []):
            try:
                wav, sr = model_mod.generate(
                    text=text,
                    speaker=v.get("voice") or "vivian",
                    language=v.get("language") or "Auto",
                    instruct=v.get("instruct"),
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"regenerate is not supported on this backend: {exc}",
                )
            wav_bytes = encode_wav(wav, sr)
            out_variants.append(
                RegenerateVariantOut(
                    id=v["id"],
                    label=v.get("label", v["id"]),
                    audio_base64=base64.b64encode(wav_bytes).decode("ascii"),
                    duration_ms=int(len(wav) / sr * 1000),
                )
            )
        return RegenerateResponse(text=text, variants=out_variants)

    return router
