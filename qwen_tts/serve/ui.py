"""Polished Gradio Blocks app composing speaker picker + generation panel."""

import logging
import time
from typing import List, Optional

import gradio as gr

from . import model as model_mod
from .config import ServeConfig
from .ui_panel import build_generation_panel
from .ui_voices import CUSTOM_CSS, build_speaker_metadata_html, build_speaker_picker
from .voices import EMOTION_PRESETS, SPEAKER_METADATA

log = logging.getLogger(__name__)

# Bilingual disclaimer — copied verbatim from qwen_tts/cli/demo.py:584-589.
DISCLAIMER_MD = """
**Disclaimer (免责声明)**
- The audio is automatically generated/synthesized by an AI model solely to demonstrate the model's capabilities; it may be inaccurate or inappropriate, does not represent the views of the developer/operator, and does not constitute professional advice. You are solely responsible for evaluating, using, distributing, or relying on this audio; to the maximum extent permitted by applicable law, the developer/operator disclaims liability for any direct, indirect, incidental, or consequential damages arising from the use of or inability to use the audio, except where liability cannot be excluded by law. Do not use this service to intentionally generate or replicate unlawful, harmful, defamatory, fraudulent, deepfake, or privacy/publicity/copyright/trademark‑infringing content; if a user prompts, supplies materials, or otherwise facilitates any illegal or infringing conduct, the user bears all legal consequences and the developer/operator is not responsible.
- 音频由人工智能模型自动生成/合成，仅用于体验与展示模型效果，可能存在不准确或不当之处；其内容不代表开发者/运营方立场，亦不构成任何专业建议。用户应自行评估并承担使用、传播或依赖该音频所产生的一切风险与责任；在适用法律允许的最大范围内，开发者/运营方不对因使用或无法使用本音频造成的任何直接、间接、附带或后果性损失承担责任（法律另有强制规定的除外）。严禁利用本服务故意引导生成或复制违法、有害、诽谤、欺诈、深度伪造、侵犯隐私/肖像/著作权/商标等内容；如用户通过提示词、素材或其他方式实施或促成任何违法或侵权行为，相关法律后果由用户自行承担，与开发者/运营方无关。
"""

_DEFAULT_LANGUAGES = ["Auto", "Chinese", "English", "Japanese", "Korean",
                      "German", "French", "Russian", "Portuguese", "Spanish", "Italian"]


def _resolve_speakers() -> List[str]:
    if model_mod.is_ready():
        try:
            names = model_mod.get_model().model.get_supported_speakers() or []
            return [str(n).lower() for n in names]
        except Exception as e:
            log.warning("get_supported_speakers failed: %s", e)
    return list(SPEAKER_METADATA.keys())


def _resolve_languages() -> List[str]:
    if model_mod.is_ready():
        try:
            langs = model_mod.get_model().model.get_supported_languages() or []
            merged = ["Auto"]
            for l in langs:
                if l and l not in merged:
                    merged.append(l)
            if len(merged) > 1:
                return merged
        except Exception as e:
            log.warning("get_supported_languages failed: %s", e)
    return list(_DEFAULT_LANGUAGES)


def _emotion_label_to_instruct(label: str, custom_instruct: str) -> Optional[str]:
    if not label:
        return None
    if label.endswith("Custom") or label.startswith("✨"):
        return (custom_instruct or "").strip() or None
    # Strip emoji + space → match by name.
    name = label.split(" ", 1)[-1]
    for p in EMOTION_PRESETS:
        if p.name == name:
            return p.instruct or None
    return None


def build_ui(cfg: ServeConfig) -> gr.Blocks:
    speakers = _resolve_speakers()
    languages = _resolve_languages()
    # Display→id mapping for the speaker radio
    _, speaker_pairs = build_speaker_picker(speakers)
    display_to_id = {d: sid for (d, sid) in speaker_pairs}
    id_to_display = {sid: d for (d, sid) in speaker_pairs}

    theme = gr.themes.Soft(
        font=[gr.themes.GoogleFont("Inter"), "Arial", "sans-serif"],
    )

    with gr.Blocks(css=CUSTOM_CSS, theme=theme, title="Qwen3-TTS") as demo:
        gr.Markdown(
            "# Qwen3-TTS\n"
            "Polished demo for the **Qwen3-TTS-12Hz-1.7B-CustomVoice** model. "
            "Pick a built-in voice, type any of the 10 supported languages, "
            "and dial in emotion. API docs at [/docs](/docs)."
        )

        with gr.Row():
            with gr.Column(scale=2):
                gr.Markdown("### Voice (音色)", elem_classes=["section-header"])
                speaker_radio, _pairs = build_speaker_picker(speakers)
                build_speaker_metadata_html(speakers)

            with gr.Column(scale=3):
                comps = build_generation_panel(
                    languages,
                    default_temperature=cfg.default_temperature,
                    default_top_k=cfg.default_top_k,
                    default_top_p=cfg.default_top_p,
                    default_repetition_penalty=cfg.default_repetition_penalty,
                    default_max_new_tokens=cfg.default_max_new_tokens,
                )

        gr.Markdown(DISCLAIMER_MD)

        # Toggle custom_instruct visibility when emotion changes.
        def _on_emotion_change(label: str):
            is_custom = (label or "").endswith("Custom") or (label or "").startswith("✨")
            return gr.update(visible=bool(is_custom))

        comps["emotion_in"].change(
            _on_emotion_change,
            inputs=[comps["emotion_in"]],
            outputs=[comps["custom_instruct"]],
        )

        adv = comps["advanced"]

        def _generate(text, speaker_display, lang, emotion_label, custom_instruct,
                      temperature, top_k, top_p, repetition_penalty, max_new_tokens,
                      seed, st_temp, st_top_k, st_top_p):
            if not text or not text.strip():
                return None, "", "Text is required (必须填写文本)."
            speaker_id = display_to_id.get(speaker_display)
            if speaker_id is None:
                return None, "", "Please pick a voice (请选择音色)."
            # Convert lowercase id back to whatever the model expects: use the
            # original display name we cached (mirrors the speaker_pairs list).
            speaker_for_model = id_to_display.get(speaker_id, speaker_display)
            instruct = _emotion_label_to_instruct(emotion_label, custom_instruct)
            try:
                t0 = time.time()
                wav, sr = model_mod.generate(
                    text=text.strip(),
                    speaker=speaker_for_model,
                    language=(lang or "Auto"),
                    instruct=instruct,
                    seed=(int(seed) if seed not in (None, "", 0) else None),
                    temperature=float(temperature) if temperature is not None else None,
                    top_k=int(top_k) if top_k is not None else None,
                    top_p=float(top_p) if top_p is not None else None,
                    repetition_penalty=float(repetition_penalty) if repetition_penalty is not None else None,
                    max_new_tokens=int(max_new_tokens) if max_new_tokens is not None else None,
                    subtalker_temperature=float(st_temp) if st_temp is not None else None,
                    subtalker_top_k=int(st_top_k) if st_top_k is not None else None,
                    subtalker_top_p=float(st_top_p) if st_top_p is not None else None,
                )
                dt = time.time() - t0
                return (int(sr), wav), f"Generated in **{dt:.2f}s** @ {sr} Hz", "OK"
            except Exception as e:
                log.exception("generate failed")
                return None, "", f"{type(e).__name__}: {e}"

        comps["btn"].click(
            _generate,
            inputs=[
                comps["text_in"], speaker_radio, comps["lang_in"],
                comps["emotion_in"], comps["custom_instruct"],
                adv["temperature"], adv["top_k"], adv["top_p"],
                adv["repetition_penalty"], adv["max_new_tokens"], adv["seed"],
                adv["subtalker_temperature"], adv["subtalker_top_k"], adv["subtalker_top_p"],
            ],
            outputs=[comps["audio_out"], comps["latency_md"], comps["status_out"]],
        )

    return demo
