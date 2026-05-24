"""Metadata API routes: /v1/voices, /v1/voices/{id}/preview, /v1/languages, /v1/health."""

from typing import List

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from . import model as model_mod
from .config import ServeConfig
from .previews import ensure_preview, preview_path
from .schemas import (
    HealthResponse,
    LanguagesResponse,
    VoiceInfoResponse,
    VoicesListResponse,
)
from .voices import SPEAKER_METADATA, SpeakerInfo


_DEFAULT_LANGUAGES = ["Auto", "Chinese", "English", "Japanese", "Korean",
                      "German", "French", "Russian", "Portuguese", "Spanish", "Italian"]


def _synthesize_speaker_info(name: str) -> SpeakerInfo:
    """Fallback record for speakers the model reports but we don't have metadata for."""
    return SpeakerInfo(
        id=name.lower(),
        display_name=name.title() if name.islower() else name,
        gender="unknown",
        age_group="adult",
        language="Unknown",
        accent="Unknown",
        description="Built-in voice",
        default_preview_text="Hello.",
    )


def _resolved_speaker_ids() -> List[str]:
    """Return lowercased canonical speaker ids by intersecting model output with metadata,
    plus model-only speakers (synthesized records will be used)."""
    out: List[str] = []
    if model_mod.is_ready():
        names = model_mod.get_model().model.get_supported_speakers() or []
        for n in names:
            out.append(str(n).lower())
    else:
        out = list(SPEAKER_METADATA.keys())
    # De-dupe while preserving order
    seen = set()
    ordered = []
    for x in out:
        if x not in seen:
            seen.add(x)
            ordered.append(x)
    return ordered


def _info_for(sid: str) -> SpeakerInfo:
    return SPEAKER_METADATA.get(sid.lower()) or _synthesize_speaker_info(sid)


def build_router(cfg: ServeConfig) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        ready = model_mod.is_ready()
        return HealthResponse(
            status="ok" if ready else "loading",
            model_ready=ready,
            model_path=cfg.model_path,
            variant=cfg.variant,
        )

    if cfg.variant == "customvoice":
        @router.get("/voices", response_model=VoicesListResponse)
        def list_voices() -> VoicesListResponse:
            voices = []
            for sid in _resolved_speaker_ids():
                info = _info_for(sid)
                voices.append(VoiceInfoResponse(
                    id=info.id,
                    display_name=info.display_name,
                    gender=info.gender,
                    age_group=info.age_group,
                    language=info.language,
                    accent=info.accent,
                    description=info.description,
                    preview_url=f"/v1/voices/{info.id}/preview",
                ))
            return VoicesListResponse(voices=voices)

        @router.get("/voices/{voice_id}/preview")
        def get_preview(voice_id: str):
            sid = voice_id.lower()
            if sid not in _resolved_speaker_ids():
                raise HTTPException(status_code=404, detail=f"Unknown voice: {voice_id}")
            p = preview_path(cfg.preview_cache_dir, sid)
            if not p.exists():
                try:
                    p = ensure_preview(cfg.preview_cache_dir, sid)
                except Exception as e:
                    raise HTTPException(status_code=503, detail=f"preview generation failed: {e}")
            return FileResponse(str(p), media_type="audio/wav", filename=f"{sid}.wav")

    @router.get("/languages", response_model=LanguagesResponse)
    def list_languages() -> LanguagesResponse:
        langs = list(_DEFAULT_LANGUAGES)
        if model_mod.is_ready():
            try:
                model_langs = model_mod.get_model().model.get_supported_languages() or []
                merged: List[str] = ["Auto"]
                for l in model_langs:
                    if l and l not in merged:
                        merged.append(l)
                langs = merged
            except Exception:
                pass
        return LanguagesResponse(languages=langs)

    return router
