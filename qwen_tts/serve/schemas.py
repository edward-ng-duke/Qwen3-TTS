from typing import List, Literal, Optional

from pydantic import BaseModel, Field

AudioFormat = Literal["wav", "mp3", "flac", "pcm"]


class SamplingParams(BaseModel):
    temperature: Optional[float] = None
    top_k: Optional[int] = None
    top_p: Optional[float] = None
    repetition_penalty: Optional[float] = None
    max_new_tokens: Optional[int] = None
    subtalker_temperature: Optional[float] = None
    subtalker_top_k: Optional[int] = None
    subtalker_top_p: Optional[float] = None


class OpenAISpeechRequest(BaseModel):
    model: str = Field(default="qwen3-tts-12hz-1.7b-customvoice")
    input: str
    voice: str
    response_format: AudioFormat = "wav"
    speed: float = 1.0


class NativeTTSRequest(BaseModel):
    text: str
    speaker: str
    language: Optional[str] = "Auto"
    instruct: Optional[str] = None
    response_format: AudioFormat = "wav"
    sampling: Optional[SamplingParams] = None
    seed: Optional[int] = None


class NativeStreamRequest(NativeTTSRequest):
    chunk_ms: int = 200


class VoiceInfoResponse(BaseModel):
    id: str
    display_name: str
    gender: str
    age_group: str
    language: str
    accent: str
    description: str
    preview_url: str


class VoicesListResponse(BaseModel):
    voices: List[VoiceInfoResponse]


class LanguagesResponse(BaseModel):
    languages: List[str]


class HealthResponse(BaseModel):
    status: Literal["ok", "loading", "error"]
    model_ready: bool
    model_path: str
    variant: str


class VoiceDesignRequest(BaseModel):
    text: str
    instruct: str
    language: Optional[str] = "Auto"
    response_format: AudioFormat = "wav"
    sampling: Optional[SamplingParams] = None
    seed: Optional[int] = None
