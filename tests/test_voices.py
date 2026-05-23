from qwen_tts.serve.voices import SPEAKER_METADATA, EMOTION_PRESETS, SpeakerInfo, EmotionPreset


def test_speaker_keys_are_lowercase():
    for k, v in SPEAKER_METADATA.items():
        assert k == k.lower()
        assert v.id == k


def test_emotion_presets_complete():
    names = [p.name for p in EMOTION_PRESETS]
    assert "Neutral" in names and "Happy" in names and "Angry" in names
    assert EMOTION_PRESETS[0].instruct == ""


def test_speaker_info_shape():
    s = next(iter(SPEAKER_METADATA.values()))
    assert isinstance(s, SpeakerInfo)
    assert s.gender in {"female", "male"}
    assert s.age_group in {"child", "young", "adult", "senior"}
