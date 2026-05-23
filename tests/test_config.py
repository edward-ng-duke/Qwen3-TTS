from qwen_tts.serve.config import ServeConfig


def test_defaults():
    cfg = ServeConfig()
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
    cfg = ServeConfig.from_env()
    assert cfg.model_path == "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
