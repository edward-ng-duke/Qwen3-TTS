from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class SpeakerInfo:
    id: str            # lowercase canonical
    display_name: str  # title-case
    gender: str        # "female" | "male"
    age_group: str     # "child" | "young" | "adult" | "senior"
    language: str      # primary language
    accent: str        # dialect/accent label, e.g. "Mandarin", "Cantonese", "American"
    description: str   # one-line marketing
    default_preview_text: str
    default_preview_instruct: str = ""


@dataclass(frozen=True)
class EmotionPreset:
    emoji: str
    name: str
    instruct: str  # empty string means "neutral / no instruct"


SPEAKER_METADATA: Dict[str, SpeakerInfo] = {
    "vivian": SpeakerInfo(
        id="vivian",
        display_name="Vivian",
        gender="female",
        age_group="adult",
        language="Chinese",
        accent="Mandarin",
        description="Warm Mandarin female, mature and articulate",
        default_preview_text="今天天气真好，我们一起出去走走吧。",
    ),
    "ryan": SpeakerInfo(
        id="ryan",
        display_name="Ryan",
        gender="male",
        age_group="adult",
        language="English",
        accent="American",
        description="Confident American English male",
        default_preview_text="Hello, this is a quick voice preview.",
    ),
}


EMOTION_PRESETS: List[EmotionPreset] = [
    EmotionPreset("😐", "Neutral", ""),
    EmotionPreset("😊", "Happy",   "Speak in a happy and cheerful tone."),
    EmotionPreset("😢", "Sad",     "Speak in a sad and melancholic tone."),
    EmotionPreset("😡", "Angry",   "Speak in an angry and intense tone."),
    EmotionPreset("😨", "Fearful", "Speak in a fearful and trembling tone."),
    EmotionPreset("😴", "Calm",    "Speak in a calm and soothing tone."),
]
