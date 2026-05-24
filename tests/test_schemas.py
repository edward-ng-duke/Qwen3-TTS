import pytest
from pydantic import ValidationError

from qwen_tts.serve.schemas import (
    OpenAISpeechRequest, NativeTTSRequest, NativeStreamRequest,
    SamplingParams, VoiceInfoResponse, VoicesListResponse,
    LanguagesResponse, HealthResponse,
)


def test_openai_request_parses():
    r = OpenAISpeechRequest(model="qwen3-tts", input="hi", voice="Vivian")
    assert r.response_format == "wav"
    assert r.speed == 1.0


def test_openai_request_format_validation():
    with pytest.raises(ValidationError):
        OpenAISpeechRequest(model="x", input="hi", voice="V", response_format="ogg")  # type: ignore[arg-type]


def test_native_request_optional_fields():
    r = NativeTTSRequest(text="hi", speaker="Vivian")
    assert r.language == "Auto"
    assert r.instruct is None
    assert r.sampling is None
    assert r.seed is None


def test_native_request_with_sampling():
    r = NativeTTSRequest(
        text="hello",
        speaker="Ryan",
        language="English",
        instruct="happy",
        sampling=SamplingParams(temperature=0.7, top_k=40),
        seed=42,
    )
    assert r.sampling.temperature == 0.7
    assert r.sampling.top_k == 40
    assert r.seed == 42


def test_stream_request_chunk_ms_default():
    r = NativeStreamRequest(text="x", speaker="Vivian")
    assert r.chunk_ms == 200


def test_voice_info_shape():
    v = VoiceInfoResponse(
        id="vivian", display_name="Vivian", gender="female", age_group="adult",
        language="Chinese", accent="Mandarin", description="warm",
        preview_url="/v1/voices/vivian/preview",
    )
    lst = VoicesListResponse(voices=[v])
    assert lst.voices[0].id == "vivian"


def test_health_response():
    h = HealthResponse(status="ok", model_ready=True, model_path="/models/x", variant="customvoice")
    assert h.model_ready is True


def test_languages_response():
    ls = LanguagesResponse(languages=["Auto", "Chinese", "English"])
    assert "Auto" in ls.languages


def test_voice_design_request_round_trip():
    from qwen_tts.serve.schemas import VoiceDesignRequest
    req = VoiceDesignRequest(
        text="hi",
        instruct="speak in an angry tone",
        language="English",
        response_format="mp3",
        sampling={"temperature": 0.7, "top_k": 40},
        seed=42,
    )
    d = req.model_dump()
    assert d["text"] == "hi"
    assert d["instruct"] == "speak in an angry tone"
    assert d["response_format"] == "mp3"
    assert d["sampling"]["temperature"] == 0.7
    assert d["seed"] == 42


def test_voice_design_request_defaults():
    from qwen_tts.serve.schemas import VoiceDesignRequest
    req = VoiceDesignRequest(text="hi", instruct="calm")
    assert req.language == "Auto"
    assert req.response_format == "wav"
    assert req.sampling is None
    assert req.seed is None
