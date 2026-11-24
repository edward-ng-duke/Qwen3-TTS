from typing import List, Literal, Optional

from pydantic import BaseModel, Field

AudioFormat = Literal["wav", "mp3", "flac", "pcm"]


class SamplingParams(BaseModel):
    temperature: Optional[float] = None
    top_k: Optional[int] = None
    top_p: Optional[float] = None
    repetition_penalty: Optional[float] = None
    max_new_tokens: Optional[int] = Field(default=None, ge=1, le=4096)
    subtalker_temperature: Optional[float] = None
    subtalker_top_k: Optional[int] = None
    subtalker_top_p: Optional[float] = None


class OpenAISpeechRequest(BaseModel):
    model: str = Field(default="qwen3-tts-12hz-1.7b-customvoice")
    input: str = Field(max_length=4000)
    voice: str = Field(max_length=100)
    response_format: AudioFormat = "wav"
    speed: float = 1.0


class NativeTTSRequest(BaseModel):
    text: str = Field(max_length=4000)
    speaker: str = Field(max_length=100)
    language: Optional[str] = "Auto"
    instruct: Optional[str] = Field(default=None, max_length=2000)
    response_format: AudioFormat = "wav"
    sampling: Optional[SamplingParams] = None
    seed: Optional[int] = None


class NativeStreamRequest(NativeTTSRequest):
    chunk_ms: int = Field(default=200, ge=20, le=2000)


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
    variant: str


class VoiceDesignRequest(BaseModel):
    text: str = Field(max_length=4000)
    instruct: str = Field(max_length=2000)
    language: Optional[str] = "Auto"
    response_format: AudioFormat = "wav"
    sampling: Optional[SamplingParams] = None
    seed: Optional[int] = None
