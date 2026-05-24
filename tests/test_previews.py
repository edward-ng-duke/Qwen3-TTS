import numpy as np
import soundfile as sf

from qwen_tts.serve import previews as previews_mod


def _stub_generate(*, text, speaker, language="Auto", instruct=None, **_):
    # 0.5s of silence at 24kHz, mono float32.
    sr = 24000
    return np.zeros(sr // 2, dtype=np.float32), sr


def test_ensure_preview_creates_file(tmp_path, monkeypatch):
    monkeypatch.setattr(previews_mod, "generate", _stub_generate)
    p = previews_mod.ensure_preview(str(tmp_path), "vivian")
    assert p.exists()
    data, sr = sf.read(str(p), dtype="float32")
    assert sr == 24000
    assert data.shape[0] == 12000


def test_ensure_preview_is_idempotent(tmp_path, monkeypatch):
    calls = {"n": 0}

    def counting(*, text, speaker, language="Auto", instruct=None, **_):
        calls["n"] += 1
        return _stub_generate(text=text, speaker=speaker)

    monkeypatch.setattr(previews_mod, "generate", counting)
    previews_mod.ensure_preview(str(tmp_path), "vivian")
    previews_mod.ensure_preview(str(tmp_path), "vivian")
    assert calls["n"] == 1


def test_ensure_preview_unknown_speaker(tmp_path, monkeypatch):
    monkeypatch.setattr(previews_mod, "generate", _stub_generate)
    try:
        previews_mod.ensure_preview(str(tmp_path), "zzz_unknown_speaker")
    except ValueError as e:
        assert "Unknown speaker" in str(e)
    else:
        raise AssertionError("expected ValueError")


def test_ensure_all_previews_swallows_errors(tmp_path, monkeypatch):
    monkeypatch.setattr(previews_mod, "generate", _stub_generate)
    # Mix one known + one unknown id; should not raise.
    previews_mod.ensure_all_previews(str(tmp_path), ["vivian", "zzz_unknown_speaker"])
    assert (tmp_path / "vivian.wav").exists()
    assert not (tmp_path / "zzz_unknown_speaker.wav").exists()
