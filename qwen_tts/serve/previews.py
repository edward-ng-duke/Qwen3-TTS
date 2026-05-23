"""Speaker preview generation + on-disk cache."""

import logging
from pathlib import Path
from typing import Iterable

import soundfile as sf

from .model import generate
from .voices import SPEAKER_METADATA

log = logging.getLogger(__name__)


def preview_path(cache_dir: str, speaker_id: str) -> Path:
    return Path(cache_dir) / f"{speaker_id.lower()}.wav"


def ensure_preview(cache_dir: str, speaker_id: str, *, force: bool = False) -> Path:
    """Generate the preview wav for one speaker if missing (or if force=True)."""
    Path(cache_dir).mkdir(parents=True, exist_ok=True)
    sid = speaker_id.lower()
    p = preview_path(cache_dir, sid)
    if p.exists() and not force:
        return p

    info = SPEAKER_METADATA.get(sid)
    if info is None:
        raise ValueError(f"Unknown speaker: {speaker_id}")

    wav, sr = generate(
        text=info.default_preview_text,
        speaker=info.display_name,
        language=info.language,
        instruct=(info.default_preview_instruct or None),
    )
    sf.write(str(p), wav, sr)
    log.info("Generated preview for %s → %s", sid, p)
    return p


def ensure_all_previews(cache_dir: str, speaker_ids: Iterable[str]) -> None:
    """Best-effort: generate previews for every supplied id, logging individual failures."""
    for sid in speaker_ids:
        try:
            ensure_preview(cache_dir, sid)
        except Exception as e:
            log.warning("Preview failed for %s: %s", sid, e)
