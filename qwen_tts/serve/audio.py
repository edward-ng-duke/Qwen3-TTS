"""Audio encoding utilities. Each encoder accepts a float32 mono waveform
in [-1.0, 1.0] (or int16) plus a sample rate and returns encoded bytes."""

import io
from typing import Tuple

import numpy as np
import soundfile as sf


def _to_float32(wav: np.ndarray) -> np.ndarray:
    wav = np.asarray(wav)
    if np.issubdtype(wav.dtype, np.integer):
        # Assume int16-like; normalize to [-1,1].
        info = np.iinfo(wav.dtype)
        scale = float(max(abs(info.min), info.max))
        wav = wav.astype(np.float32) / scale
    else:
        wav = wav.astype(np.float32)
    if wav.ndim > 1:
        wav = wav.mean(axis=-1).astype(np.float32)
    return wav


def encode_wav(wav: np.ndarray, sr: int) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, _to_float32(wav), int(sr), format="WAV", subtype="PCM_16")
    return buf.getvalue()


def encode_flac(wav: np.ndarray, sr: int) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, _to_float32(wav), int(sr), format="FLAC")
    return buf.getvalue()


def encode_pcm(wav: np.ndarray, sr: int) -> bytes:
    """Raw little-endian int16 PCM, no header."""
    w = _to_float32(wav)
    w = np.clip(w, -1.0, 1.0)
    i16 = (w * 32767.0).astype("<i2")
    return i16.tobytes()


def encode_mp3(wav: np.ndarray, sr: int) -> bytes:
    """MP3 via pydub (requires ffmpeg on PATH)."""
    from pydub import AudioSegment

    w = _to_float32(wav)
    w = np.clip(w, -1.0, 1.0)
    i16 = (w * 32767.0).astype("<i2")
    seg = AudioSegment(
        data=i16.tobytes(),
        sample_width=2,
        frame_rate=int(sr),
        channels=1,
    )
    out = io.BytesIO()
    seg.export(out, format="mp3", bitrate="128k")
    return out.getvalue()


ENCODERS = {
    "wav": encode_wav,
    "flac": encode_flac,
    "pcm": encode_pcm,
    "mp3": encode_mp3,
}

CONTENT_TYPES = {
    "wav": "audio/wav",
    "flac": "audio/flac",
    "pcm": "audio/L16; rate={sr}; channels=1",
    "mp3": "audio/mpeg",
}


def encode(wav: np.ndarray, sr: int, fmt: str) -> Tuple[bytes, str]:
    fmt = (fmt or "wav").lower()
    if fmt not in ENCODERS:
        raise ValueError(f"Unsupported format: {fmt}")
    body = ENCODERS[fmt](wav, sr)
    ctype = CONTENT_TYPES[fmt].format(sr=int(sr))
    return body, ctype
