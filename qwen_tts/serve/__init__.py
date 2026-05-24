"""Qwen3-TTS serving layer (FastAPI + Gradio + REST API)."""

from .app import create_app  # noqa: F401
from .__main__ import main  # noqa: F401

__all__ = ["create_app", "main"]
