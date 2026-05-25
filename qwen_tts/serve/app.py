"""Composes the FastAPI application: routers + Gradio mount + startup hooks.

The app is variant-aware: ``cfg.variant`` decides which routers and which
Gradio UI get registered.
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import gradio as gr
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import model as model_mod
from .api_meta import build_router as build_meta_router
from .config import ServeConfig
from .previews import ensure_all_previews
from .voices import SPEAKER_METADATA

log = logging.getLogger(__name__)


def _build_variant_router(variant: str):
    if variant == "customvoice":
        from .api_native import build_router as nat
        from .api_openai import build_router as oai
        return [nat(), oai()]
    if variant == "voicedesign":
        from .api_design import build_router as design
        return [design()]
    if variant == "base":
        from .api_clone import build_router as clone
        return [clone()]
    raise ValueError(f"Unknown variant: {variant!r}")


def _build_legacy_blocks(cfg: ServeConfig) -> gr.Blocks:
    if cfg.variant == "customvoice":
        from .ui import build_ui
        return build_ui(cfg)
    # VoiceDesign / Base: reuse the official Qwen Gradio demo.
    from qwen_tts.cli.demo import build_demo
    return build_demo(model_mod.get_model(), cfg.model_path, {})


def create_app(cfg: ServeConfig, *, load_model_on_startup: bool = True) -> FastAPI:
    # Non-customvoice variants mount the official Qwen Gradio at /legacy, and
    # build_demo() needs a *loaded* Qwen3TTSModel to introspect supported
    # speakers/languages. FastAPI's lifespan fires AFTER route mounts, so we
    # eager-load the model here when needed. load_model is idempotent.
    if (
        load_model_on_startup
        and cfg.variant != "customvoice"
        and not model_mod.is_ready()
    ):
        log.info("Eager-loading model (variant=%s) from %s for Gradio mount ...",
                 cfg.variant, cfg.model_path)
        try:
            model_mod.load_model(cfg)
            log.info("Model loaded.")
        except Exception as e:
            log.exception("Eager model load failed: %s", e)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if load_model_on_startup and not model_mod.is_ready():
            log.info("Loading model (variant=%s) from %s ...", cfg.variant, cfg.model_path)
            try:
                model_mod.load_model(cfg)
                log.info("Model loaded.")
            except Exception as e:
                log.exception("Model load failed: %s", e)
        if model_mod.is_ready() and cfg.variant == "customvoice":
            try:
                spks = []
                names = model_mod.get_model().model.get_supported_speakers() or []
                spks = [str(n).lower() for n in names]
                if not spks:
                    spks = list(SPEAKER_METADATA.keys())
                ensure_all_previews(cfg.preview_cache_dir, spks)
            except Exception as e:
                log.warning("Preview generation failed: %s", e)
        yield

    app = FastAPI(title=f"Qwen3-TTS Serve ({cfg.variant})", version="0.1.0", lifespan=lifespan)
    app.include_router(build_meta_router(cfg))
    for r in _build_variant_router(cfg.variant):
        app.include_router(r)

    blocks = _build_legacy_blocks(cfg)
    app = gr.mount_gradio_app(app, blocks, path="/legacy")

    @app.get("/legacy")
    def _legacy_redirect() -> RedirectResponse:
        return RedirectResponse(url="/legacy/", status_code=307)

    if cfg.variant == "customvoice":
        web_dist = Path(os.environ.get("WEB_DIST", "/app/web/dist"))
        if web_dist.is_dir() and (web_dist / "index.html").exists():
            app.mount(
                "/",
                StaticFiles(directory=str(web_dist), html=True),
                name="web",
            )
            log.info("Mounted React web at / (dist=%s)", web_dist)
        else:
            log.warning(
                "web/dist not found at %s — Gradio at /legacy is the only UI", web_dist
            )
    else:
        @app.get("/")
        def _root_redirect() -> RedirectResponse:
            return RedirectResponse(url="/legacy/", status_code=307)

    return app
