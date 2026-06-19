from fastapi.testclient import TestClient

from qwen_tts.serve import model as model_mod
from qwen_tts.serve.app import create_app
from qwen_tts.serve.config import ServeConfig


class _FakeTTSInner:
    def get_supported_speakers(self): return ["Vivian"]
    def get_supported_languages(self): return ["Chinese", "English"]


class _FakeWrapper:
    model = _FakeTTSInner()


def _route_paths(app):
    return {r.path for r in app.routes}


def _build(variant, monkeypatch, tmp_path):
    monkeypatch.setattr(model_mod, "_instance", _FakeWrapper())
    cfg = ServeConfig(variant=variant, model_path="/x",
                      preview_cache_dir=str(tmp_path))
    # build_demo for non-customvoice variants needs a real-ish tts wrapper —
    # supply a stub via monkeypatch on qwen_tts.cli.demo.build_demo at this point.
    if variant != "customvoice":
        import gradio as gr
        from qwen_tts.cli import demo as demo_mod
        monkeypatch.setattr(demo_mod, "build_demo",
                            lambda tts, ckpt, gen_kwargs_default: gr.Blocks())
    app = create_app(cfg, load_model_on_startup=False)
    return app


def test_customvoice_routes_present(monkeypatch, tmp_path):
    app = _build("customvoice", monkeypatch, tmp_path)
    paths = _route_paths(app)
    assert "/v1/tts" in paths
    assert "/v1/audio/speech" in paths
    assert "/v1/voices" in paths
    assert "/v1/health" in paths
    monkeypatch.setattr(model_mod, "_instance", None)


def test_voicedesign_routes_present(monkeypatch, tmp_path):
    app = _build("voicedesign", monkeypatch, tmp_path)
    paths = _route_paths(app)
    assert "/v1/tts/design" in paths
    assert "/v1/health" in paths
    assert "/v1/languages" in paths
    assert "/v1/tts" not in paths        # CustomVoice-only
    assert "/v1/audio/speech" not in paths
    assert "/v1/voices" not in paths
    monkeypatch.setattr(model_mod, "_instance", None)


def test_base_routes_present(monkeypatch, tmp_path):
    app = _build("base", monkeypatch, tmp_path)
    paths = _route_paths(app)
    assert "/v1/clone" in paths
    assert "/v1/voice/save" in paths
    assert "/v1/voice/generate" in paths
    assert "/v1/tts" not in paths
    assert "/v1/tts/design" not in paths
    monkeypatch.setattr(model_mod, "_instance", None)


def test_root_redirects_when_dist_missing(monkeypatch, tmp_path):
    # When web/dist isn't built, every variant falls back to the Gradio redirect.
    monkeypatch.setenv("WEB_DIST", str(tmp_path / "no-such-dist"))
    app = _build("voicedesign", monkeypatch, tmp_path)
    with TestClient(app) as c:
        r = c.get("/", follow_redirects=False)
        assert r.status_code in (307, 308)
        assert r.headers["location"].rstrip("/") == "/legacy"
    monkeypatch.setattr(model_mod, "_instance", None)


def test_root_serves_react_for_non_customvoice_when_dist_present(monkeypatch, tmp_path):
    # The variant-adaptive React app is mounted at / for ALL variants (not just
    # customvoice) when web/dist exists; the SPA self-selects via /v1/health.variant.
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>spa</title>")
    monkeypatch.setenv("WEB_DIST", str(dist))
    app = _build("base", monkeypatch, tmp_path)
    with TestClient(app) as c:
        r = c.get("/", follow_redirects=False)
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"].lower()
        # Gradio stays reachable at /legacy as the fallback.
        assert c.get("/legacy", follow_redirects=False).status_code in (200, 307, 308)
    monkeypatch.setattr(model_mod, "_instance", None)
