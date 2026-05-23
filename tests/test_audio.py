import io
import shutil

import numpy as np
import pytest
import soundfile as sf

from qwen_tts.serve.audio import (
    encode_wav, encode_flac, encode_pcm, encode_mp3, encode, CONTENT_TYPES,
)


@pytest.fixture
def wav_and_sr():
    sr = 24000
    t = np.linspace(0, 1.0, sr, endpoint=False, dtype=np.float32)
    wav = 0.5 * np.sin(2 * np.pi * 440 * t).astype(np.float32)
    return wav, sr


def test_encode_wav_roundtrip(wav_and_sr):
    wav, sr = wav_and_sr
    body = encode_wav(wav, sr)
    assert isinstance(body, bytes) and len(body) > 0
    data, sr2 = sf.read(io.BytesIO(body), dtype="float32", always_2d=False)
    assert sr2 == sr
    assert data.shape == wav.shape


def test_encode_flac_roundtrip(wav_and_sr):
    wav, sr = wav_and_sr
    body = encode_flac(wav, sr)
    assert isinstance(body, bytes) and len(body) > 0
    data, sr2 = sf.read(io.BytesIO(body), dtype="float32", always_2d=False)
    assert sr2 == sr
    assert data.shape == wav.shape


def test_encode_pcm_length(wav_and_sr):
    wav, sr = wav_and_sr
    body = encode_pcm(wav, sr)
    assert len(body) == len(wav) * 2  # int16


def test_encode_mp3_present(wav_and_sr):
    if shutil.which("ffmpeg") is None:
        pytest.skip("ffmpeg not installed")
    wav, sr = wav_and_sr
    body = encode_mp3(wav, sr)
    assert isinstance(body, bytes) and len(body) > 0
    assert body[:3] == b"ID3" or body[:2] == b"\xff\xfb" or body[:2] == b"\xff\xf3" or body[:2] == b"\xff\xf2"


def test_encode_dispatch_unknown():
    with pytest.raises(ValueError):
        encode(np.zeros(100, dtype=np.float32), 24000, "ogg")


def test_encode_dispatch_pcm_ctype(wav_and_sr):
    wav, sr = wav_and_sr
    body, ctype = encode(wav, sr, "pcm")
    assert ctype == f"audio/L16; rate={sr}; channels=1"
    assert len(body) == len(wav) * 2
