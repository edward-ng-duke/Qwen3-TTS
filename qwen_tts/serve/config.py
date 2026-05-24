import os
from dataclasses import dataclass


@dataclass
class ServeConfig:
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

        return cls(
            model_path=_get_str("MODEL_PATH", cls.model_path),
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
