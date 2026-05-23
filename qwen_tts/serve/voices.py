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
        id="vivian", display_name="Vivian",
        gender="female", age_group="adult",
        language="Chinese", accent="Mandarin",
        description="Warm Mandarin female, mature and articulate",
        default_preview_text="今天天气真好，我们一起出去走走吧。",
    ),
    "ryan": SpeakerInfo(
        id="ryan", display_name="Ryan",
        gender="male", age_group="adult",
        language="English", accent="American",
        description="Confident American English male",
        default_preview_text="Hello, this is a quick voice preview.",
    ),
    "serena": SpeakerInfo(
        id="serena", display_name="Serena",
        gender="female", age_group="young",
        language="English", accent="British",
        description="Bright young female with British inflection",
        default_preview_text="Lovely to meet you. Shall we begin?",
    ),
    "uncle_fu": SpeakerInfo(
        id="uncle_fu", display_name="Uncle Fu",
        gender="male", age_group="senior",
        language="Chinese", accent="Mandarin",
        description="Gravelly senior Mandarin male, storyteller cadence",
        default_preview_text="孩子，听我给你讲一个老故事。",
    ),
    "aiden": SpeakerInfo(
        id="aiden", display_name="Aiden",
        gender="male", age_group="young",
        language="English", accent="American",
        description="Energetic young American male",
        default_preview_text="Hey, ready to crush today? Let's go!",
    ),
    "ono_anna": SpeakerInfo(
        id="ono_anna", display_name="Ono Anna",
        gender="female", age_group="adult",
        language="Japanese", accent="Standard",
        description="Crisp standard Japanese female",
        default_preview_text="こんにちは、よろしくお願いします。",
    ),
    "sohee": SpeakerInfo(
        id="sohee", display_name="Sohee",
        gender="female", age_group="young",
        language="Korean", accent="Standard",
        description="Gentle young Korean female",
        default_preview_text="안녕하세요, 만나서 반가워요.",
    ),
    "eric": SpeakerInfo(
        id="eric", display_name="Eric",
        gender="male", age_group="adult",
        language="German", accent="Standard",
        description="Calm standard German male",
        default_preview_text="Guten Tag, schön, Sie kennenzulernen.",
    ),
    "dylan": SpeakerInfo(
        id="dylan", display_name="Dylan",
        gender="male", age_group="adult",
        language="English", accent="British",
        description="Mellow British male, podcast-friendly",
        default_preview_text="So, where shall we start the story today?",
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
