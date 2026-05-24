import sys
import types

# Block heavy transitive imports that are broken in this environment so that
# the lightweight `qwen_tts.serve.config` module can be imported in isolation.
for _mod in ("qwen_tts", "qwen_tts.serve"):
    if _mod not in sys.modules:
        _m = types.ModuleType(_mod)
        _m.__path__ = [f"/home/edward/research/Qwen3-TTS/{_mod.replace('.', '/')}"]
        _m.__package__ = _mod
        sys.modules[_mod] = _m

from qwen_tts.serve.config import ServeConfig, resolve_model_path, VALID_VARIANTS


def test_defaults():
    cfg = ServeConfig()
    assert cfg.variant == "customvoice"
    assert cfg.models_root == "/models"
    assert cfg.model_path == "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
    assert cfg.device == "cuda:0"
    assert cfg.port == 8000
    assert cfg.dtype == "bfloat16"
    assert cfg.attn_impl == "flash_attention_2"


def test_from_env_no_overrides(monkeypatch):
    for k in ["MODEL_PATH", "DEVICE", "DTYPE", "ATTN_IMPL", "HOST", "PORT",
              "PREVIEW_CACHE_DIR", "CONCURRENCY"]:
        monkeypatch.delenv(k, raising=False)
    cfg = ServeConfig.from_env()
    assert cfg.port == 8000
    assert cfg.host == "0.0.0.0"


def test_from_env_overrides(monkeypatch):
    monkeypatch.setenv("MODEL_PATH", "/models/foo")
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("DEVICE", "cuda:1")
    monkeypatch.setenv("DTYPE", "float16")
    monkeypatch.setenv("DEFAULT_TEMPERATURE", "0.5")
    monkeypatch.setenv("DEFAULT_TOP_K", "10")
    cfg = ServeConfig.from_env()
    assert cfg.model_path == "/models/foo"
    assert cfg.port == 9000
    assert cfg.device == "cuda:1"
    assert cfg.dtype == "float16"
    assert cfg.default_temperature == 0.5
    assert cfg.default_top_k == 10


def test_from_env_empty_string_falls_back(monkeypatch):
    monkeypatch.setenv("MODEL_PATH", "")
    monkeypatch.delenv("MODEL_VARIANT", raising=False)
    monkeypatch.delenv("MODELS_ROOT", raising=False)
    cfg = ServeConfig.from_env()
    assert cfg.model_path.endswith("Qwen3-TTS-12Hz-1.7B-CustomVoice")


def test_resolve_model_path_known_variants():
    assert resolve_model_path("customvoice", "/models").endswith("Qwen3-TTS-12Hz-1.7B-CustomVoice")
    assert resolve_model_path("voicedesign", "/models").endswith("Qwen3-TTS-12Hz-1.7B-VoiceDesign")
    assert resolve_model_path("base", "/models").endswith("Qwen3-TTS-12Hz-1.7B-Base")


def test_resolve_model_path_invalid():
    import pytest
    with pytest.raises(ValueError):
        resolve_model_path("bogus", "/models")


def test_variant_default_is_customvoice(monkeypatch):
    for k in ("MODEL_VARIANT", "MODEL_PATH"):
        monkeypatch.delenv(k, raising=False)
    cfg = ServeConfig.from_env()
    assert cfg.variant == "customvoice"
    assert cfg.model_path.endswith("Qwen3-TTS-12Hz-1.7B-CustomVoice")


def test_variant_resolved_path_when_model_path_empty(monkeypatch):
    monkeypatch.setenv("MODEL_VARIANT", "voicedesign")
    monkeypatch.delenv("MODEL_PATH", raising=False)
    monkeypatch.setenv("MODELS_ROOT", "/srv/models")
    cfg = ServeConfig.from_env()
    assert cfg.variant == "voicedesign"
    assert cfg.model_path == "/srv/models/Qwen3-TTS-12Hz-1.7B-VoiceDesign"


def test_explicit_model_path_overrides_variant_resolution(monkeypatch):
    monkeypatch.setenv("MODEL_VARIANT", "base")
    monkeypatch.setenv("MODEL_PATH", "/somewhere/else")
    cfg = ServeConfig.from_env()
    # variant stays as declared, path is honored
    assert cfg.variant == "base"
    assert cfg.model_path == "/somewhere/else"


def test_variant_inferred_from_path_basename(monkeypatch):
    monkeypatch.delenv("MODEL_VARIANT", raising=False)
    monkeypatch.setenv("MODEL_PATH", "/foo/Qwen3-TTS-12Hz-1.7B-VoiceDesign")
    cfg = ServeConfig.from_env()
    assert cfg.variant == "voicedesign"
