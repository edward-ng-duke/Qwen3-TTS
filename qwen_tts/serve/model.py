"""Thread-safe singleton for Qwen3TTSModel + a convenience generate()."""

import threading
from typing import Optional, Tuple

import numpy as np
import torch

from .config import ServeConfig

_load_lock = threading.Lock()
_gen_lock = threading.Lock()  # serialize GPU generation calls
_instance = None  # type: ignore[var-annotated]


def _dtype(name: str) -> torch.dtype:
    name = (name or "").lower()
    table = {
        "bfloat16": torch.bfloat16, "bf16": torch.bfloat16,
        "float16": torch.float16, "fp16": torch.float16, "half": torch.float16,
        "float32": torch.float32, "fp32": torch.float32,
    }
    if name not in table:
        raise ValueError(f"Unsupported dtype: {name}")
    return table[name]


def load_model(cfg: ServeConfig):
    """Idempotent loader: builds the singleton on first call."""
    global _instance
    with _load_lock:
        if _instance is not None:
            return _instance
        from qwen_tts import Qwen3TTSModel  # local import to keep module light
        kwargs = {"device_map": cfg.device, "dtype": _dtype(cfg.dtype)}
        if cfg.attn_impl:
            kwargs["attn_implementation"] = cfg.attn_impl
        _instance = Qwen3TTSModel.from_pretrained(cfg.model_path, **kwargs)
        return _instance


def is_ready() -> bool:
    return _instance is not None


def get_model():
    if _instance is None:
        raise RuntimeError("Model not loaded — call load_model(cfg) first.")
    return _instance


def reset_for_testing() -> None:
    """Clear the singleton — for tests only."""
    global _instance
    with _load_lock:
        _instance = None


def generate(
    *,
    text: str,
    speaker: str,
    language: str = "Auto",
    instruct: Optional[str] = None,
    seed: Optional[int] = None,
    **sampling,
) -> Tuple[np.ndarray, int]:
    """Thread-safe single-sample CustomVoice generation.

    Returns (waveform_float32_mono, sample_rate).
    """
    tts = get_model()
    sampling = {k: v for k, v in sampling.items() if v is not None}
    with _gen_lock:
        if seed is not None:
            torch.manual_seed(int(seed))
        wavs, sr = tts.generate_custom_voice(
            text=text,
            speaker=speaker,
            language=(language or "Auto"),
            instruct=(instruct if instruct else None),
            **sampling,
        )
    wav = np.asarray(wavs[0])
    return wav, int(sr)
