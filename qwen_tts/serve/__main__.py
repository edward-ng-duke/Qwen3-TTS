"""CLI entry: python -m qwen_tts.serve / qwen-tts-serve."""

import argparse
import logging

from .config import ServeConfig


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="qwen-tts-serve",
        description=(
            "Serve the Qwen3-TTS-12Hz-1.7B-CustomVoice model via FastAPI + Gradio.\n"
            "Demo UI is mounted at /, REST API under /v1/*.\n"
            "All flags fall back to env vars (MODEL_PATH, DEVICE, DTYPE, ATTN_IMPL, "
            "HOST, PORT, PREVIEW_CACHE_DIR) and then to defaults."
        ),
    )
    p.add_argument("--host", default=None)
    p.add_argument("--port", type=int, default=None)
    p.add_argument("--model-path", default=None)
    p.add_argument("--device", default=None)
    p.add_argument("--dtype", default=None, choices=["bfloat16", "float16", "float32"])
    p.add_argument("--attn-impl", default=None,
                   help="attention implementation: flash_attention_2 | sdpa | eager")
    p.add_argument("--no-flash-attn", action="store_true",
                   help="shortcut for --attn-impl sdpa")
    p.add_argument("--preview-cache-dir", default=None)
    p.add_argument("--log-level", default="info",
                   choices=["debug", "info", "warning", "error"])
    return p


def main(argv=None) -> int:
    import uvicorn  # local import keeps `--help` fast
    from .app import create_app

    args = _build_parser().parse_args(argv)
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    cfg = ServeConfig.from_env()
    for field in ("host", "port", "model_path", "device", "dtype",
                  "attn_impl", "preview_cache_dir"):
        v = getattr(args, field)
        if v is not None:
            setattr(cfg, field, v)
    if args.no_flash_attn:
        cfg.attn_impl = "sdpa"

    logging.getLogger(__name__).info(
        "Starting Qwen3-TTS serve on %s:%s (model=%s, device=%s, dtype=%s, attn=%s)",
        cfg.host, cfg.port, cfg.model_path, cfg.device, cfg.dtype, cfg.attn_impl,
    )

    app = create_app(cfg)
    uvicorn.run(app, host=cfg.host, port=cfg.port, log_level=args.log_level)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
