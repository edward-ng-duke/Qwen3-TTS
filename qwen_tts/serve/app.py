"""Composes the FastAPI application: routers + Gradio mount + startup hooks."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import gradio as gr
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import model as model_mod
from .api_meta import build_router as build_meta_router
from .api_native import build_router as build_native_router
from .api_openai import build_router as build_openai_router
from .config import ServeConfig
from .previews import ensure_all_previews
from .ui import build_ui
from .voices import SPEAKER_METADATA

log = logging.getLogger(__name__)


def create_app(cfg: ServeConfig, *, load_model_on_startup: bool = True) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if load_model_on_startup:
            log.info("Loading model from %s ...", cfg.model_path)
            try:
                model_mod.load_model(cfg)
                log.info("Model loaded.")
            except Exception as e:
                log.exception("Model load failed: %s", e)
            else:
                # Best-effort preview generation.
                try:
                    spks = []
                    if model_mod.is_ready():
                        names = model_mod.get_model().model.get_supported_speakers() or []
                        spks = [str(n).lower() for n in names]
                    if not spks:
                        spks = list(SPEAKER_METADATA.keys())
                    ensure_all_previews(cfg.preview_cache_dir, spks)
                except Exception as e:
                    log.warning("Preview generation failed: %s", e)
        yield

    app = FastAPI(title="Qwen3-TTS Serve", version="0.1.0", lifespan=lifespan)
    app.include_router(build_meta_router(cfg))
    app.include_router(build_openai_router())
    app.include_router(build_native_router())

    blocks = build_ui(cfg)
    app = gr.mount_gradio_app(app, blocks, path="/legacy")

    # React SPA (web/dist) takes over `/`. Mount LAST so it can serve index.html
    # via StaticFiles(html=True) without shadowing the /v1/* and /legacy routes
    # already registered above.
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
    return app
