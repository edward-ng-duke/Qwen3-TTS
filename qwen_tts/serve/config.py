import os
from dataclasses import dataclass
from typing import Tuple


VALID_VARIANTS: Tuple[str, ...] = ("customvoice", "voicedesign", "base")

_VARIANT_TO_DIRNAME = {
    "customvoice": "Qwen3-TTS-12Hz-1.7B-CustomVoice",
    "voicedesign": "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    "base":        "Qwen3-TTS-12Hz-1.7B-Base",
}

# Reverse: directory basename -> variant key (case-insensitive).
_DIRNAME_TO_VARIANT = {v.lower(): k for k, v in _VARIANT_TO_DIRNAME.items()}


def resolve_model_path(variant: str, models_root: str) -> str:
    v = (variant or "").strip().lower()
    if v not in VALID_VARIANTS:
        raise ValueError(f"Invalid variant: {variant!r}. Use one of {VALID_VARIANTS}.")
    return os.path.join(models_root, _VARIANT_TO_DIRNAME[v])


def _infer_variant_from_path(path: str) -> str:
    """Best-effort: return one of VALID_VARIANTS based on the directory basename,
    or '' if we can't tell."""
    base = os.path.basename(path.rstrip("/")).lower()
    return _DIRNAME_TO_VARIANT.get(base, "")


@dataclass
class ServeConfig:
    variant: str = "customvoice"
    models_root: str = "/models"
    model_path: str = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
    device: str = "cuda:0"
    dtype: str = "bfloat16"           # bfloat16 | float16 | float32
    attn_impl: str = "flash_attention_2"  # or "sdpa", "eager"
    host: str = "0.0.0.0"
    port: int = 8000
    preview_cache_dir: str = "/var/qwen-tts/previews"
    concurrency: int = 4
    default_temperature: float = 0.9
    default_top_k: int = 50
    default_top_p: float = 1.0
    default_repetition_penalty: float = 1.05
    default_max_new_tokens: int = 2048

    @classmethod
    def from_env(cls) -> "ServeConfig":
        def _get_str(key, default):
            v = os.environ.get(key)
            return v if v is not None and v != "" else default

        def _get_int(key, default):
            v = os.environ.get(key)
            if v is None or v == "":
                return default
            return int(v)

        def _get_float(key, default):
            v = os.environ.get(key)
            if v is None or v == "":
                return default
            return float(v)

        variant = (_get_str("MODEL_VARIANT", cls.variant) or "").strip().lower()
        if variant not in VALID_VARIANTS:
            variant = cls.variant
        models_root = _get_str("MODELS_ROOT", cls.models_root)

        # Determine model_path: explicit env wins; otherwise derive from variant.
        env_model_path = os.environ.get("MODEL_PATH")
        if env_model_path:
            model_path = env_model_path
            inferred = _infer_variant_from_path(env_model_path)
            if inferred and inferred in VALID_VARIANTS:
                variant = inferred
        else:
            model_path = resolve_model_path(variant, models_root)

        return cls(
            variant=variant,
            models_root=models_root,
            model_path=model_path,
            device=_get_str("DEVICE", cls.device),
            dtype=_get_str("DTYPE", cls.dtype),
            attn_impl=_get_str("ATTN_IMPL", cls.attn_impl),
            host=_get_str("HOST", cls.host),
            port=_get_int("PORT", cls.port),
            preview_cache_dir=_get_str("PREVIEW_CACHE_DIR", cls.preview_cache_dir),
            concurrency=_get_int("CONCURRENCY", cls.concurrency),
            default_temperature=_get_float("DEFAULT_TEMPERATURE", cls.default_temperature),
            default_top_k=_get_int("DEFAULT_TOP_K", cls.default_top_k),
            default_top_p=_get_float("DEFAULT_TOP_P", cls.default_top_p),
            default_repetition_penalty=_get_float("DEFAULT_REPETITION_PENALTY", cls.default_repetition_penalty),
            default_max_new_tokens=_get_int("DEFAULT_MAX_NEW_TOKENS", cls.default_max_new_tokens),
        )
