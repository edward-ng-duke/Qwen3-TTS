"""Gradio UI partial: voice/speaker picker + global CSS theme."""

from typing import List, Tuple

import gradio as gr

from .voices import SPEAKER_METADATA


CUSTOM_CSS = """
.gradio-container { max-width: 1400px !important; margin: 0 auto !important; }
.speaker-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.speaker-grid label {
    border: 1px solid var(--border-color-primary);
    border-radius: 10px;
    padding: 12px;
    cursor: pointer;
    transition: all .15s ease;
}
.speaker-grid label:hover {
    border-color: var(--color-accent);
    transform: translateY(-1px);
}
.speaker-grid input:checked + span,
.speaker-grid label.selected {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
}
.speaker-name { font-weight: 600; font-size: 1.05em; }
.speaker-badges { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
.speaker-badge {
    font-size: 0.75em;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-accent-soft);
}
.section-header { font-size: 1.1em; font-weight: 600; margin: 6px 0; }
.emotion-row { display: flex; gap: 8px; flex-wrap: wrap; }
.emotion-row label {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--border-color-primary);
    cursor: pointer;
}
"""


def _display_for(sid: str) -> str:
    info = SPEAKER_METADATA.get(sid.lower())
    if info is not None:
        return info.display_name
    return sid.title() if sid.islower() else sid


def build_speaker_picker(available_speakers: List[str]) -> Tuple[gr.Radio, "list[tuple[str, str]]"]:
    """Build a Radio acting as the speaker selector, styled as a card grid.

    Returns (radio_component, choices_pairs) where choices_pairs is the
    (display_name, lowercase_id) list so the outer Blocks can map back to ids.
    """
    pairs: list[tuple[str, str]] = []
    for sid in available_speakers:
        sid_lc = sid.lower()
        display = _display_for(sid)
        pairs.append((display, sid_lc))

    initial = pairs[0][0] if pairs else None
    radio = gr.Radio(
        choices=[d for (d, _) in pairs],
        value=initial,
        label="Voice (音色)",
        interactive=True,
        elem_classes=["speaker-grid"],
    )
    return radio, pairs


def build_speaker_metadata_html(available_speakers: List[str]) -> gr.HTML:
    """A decorative HTML block listing speaker badges, rendered alongside the radio."""
    rows = []
    for sid in available_speakers:
        info = SPEAKER_METADATA.get(sid.lower())
        if info is None:
            rows.append(f"<div><span class='speaker-name'>{_display_for(sid)}</span></div>")
        else:
            badges = " ".join(
                f"<span class='speaker-badge'>{x}</span>"
                for x in [info.gender, info.age_group, info.language, info.accent] if x
            )
            rows.append(
                f"<div><span class='speaker-name'>{info.display_name}</span>"
                f"<div class='speaker-badges'>{badges}</div>"
                f"<div style='opacity:0.8;font-size:0.85em;margin-top:4px'>{info.description}</div></div>"
            )
    html = "<div class='speaker-grid'>" + "".join(rows) + "</div>"
    return gr.HTML(html)
