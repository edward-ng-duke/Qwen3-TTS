"""Gradio UI partial: text input, emotion presets, advanced sampling, output panel."""

from typing import Any, Dict, List

import gradio as gr

from .voices import EMOTION_PRESETS


def build_generation_panel(
    language_choices: List[str],
    *,
    default_temperature: float = 0.9,
    default_top_k: int = 50,
    default_top_p: float = 1.0,
    default_repetition_penalty: float = 1.05,
    default_max_new_tokens: int = 2048,
) -> Dict[str, Any]:
    """Build the right-side generation panel.

    Returns a dict of components so the outer Blocks can wire callbacks:
        text_in, lang_in, emotion_in, custom_instruct, btn,
        audio_out, latency_md, status_out,
        and advanced sliders under key "advanced": dict.
    """
    components: Dict[str, Any] = {}

    text_in = gr.Textbox(
        label="Text (任意语言文本)",
        lines=4,
        placeholder="Enter text in any of the 10 supported languages…",
        show_copy_button=True,
    )
    components["text_in"] = text_in

    with gr.Row():
        lang_in = gr.Dropdown(
            choices=language_choices,
            value=language_choices[0] if language_choices else "Auto",
            label="Language (语种)",
            interactive=True,
        )
        components["lang_in"] = lang_in

    # Emotion preset radio. Display labels include emoji + name; the outer
    # callback maps name back to instruct text via EMOTION_PRESETS.
    emotion_labels = [f"{p.emoji} {p.name}" for p in EMOTION_PRESETS] + ["✨ Custom"]
    emotion_in = gr.Radio(
        choices=emotion_labels,
        value=emotion_labels[0],
        label="Emotion / Style (情绪/风格)",
        interactive=True,
        elem_classes=["emotion-row"],
    )
    components["emotion_in"] = emotion_in

    custom_instruct = gr.Textbox(
        label="Custom instruction (自定义指令)",
        lines=2,
        placeholder="e.g. Speak in a whisper, very slowly.",
        visible=False,
    )
    components["custom_instruct"] = custom_instruct

    with gr.Accordion("Advanced parameters (高级参数)", open=False):
        with gr.Row():
            temp = gr.Slider(0.1, 1.5, value=default_temperature, step=0.05,
                             label="temperature")
            top_k = gr.Slider(1, 100, value=default_top_k, step=1, label="top_k")
            top_p = gr.Slider(0.1, 1.0, value=default_top_p, step=0.05, label="top_p")
        with gr.Row():
            rep_pen = gr.Slider(1.0, 1.5, value=default_repetition_penalty, step=0.01,
                                label="repetition_penalty")
            max_new = gr.Number(value=default_max_new_tokens, precision=0,
                                label="max_new_tokens")
            seed = gr.Number(value=None, precision=0, label="seed (optional)")
        with gr.Accordion("Sub-talker (12Hz tokenizer)", open=False):
            with gr.Row():
                st_temp = gr.Slider(0.1, 1.5, value=default_temperature, step=0.05,
                                    label="subtalker_temperature")
                st_top_k = gr.Slider(1, 100, value=default_top_k, step=1,
                                     label="subtalker_top_k")
                st_top_p = gr.Slider(0.1, 1.0, value=default_top_p, step=0.05,
                                     label="subtalker_top_p")
    components["advanced"] = {
        "temperature": temp,
        "top_k": top_k,
        "top_p": top_p,
        "repetition_penalty": rep_pen,
        "max_new_tokens": max_new,
        "seed": seed,
        "subtalker_temperature": st_temp,
        "subtalker_top_k": st_top_k,
        "subtalker_top_p": st_top_p,
    }

    btn = gr.Button("Generate (生成)", variant="primary")
    components["btn"] = btn

    audio_out = gr.Audio(label="Output Audio (合成结果)", type="numpy",
                        show_download_button=True)
    components["audio_out"] = audio_out

    latency_md = gr.Markdown("")
    components["latency_md"] = latency_md

    status_out = gr.Textbox(label="Status (状态)", lines=2, interactive=False)
    components["status_out"] = status_out

    return components
