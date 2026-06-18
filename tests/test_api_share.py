"""Share / gallery route tests.

Hermetic: the real ShareStore is exercised against a tiny in-memory async Mongo
fake + real disk (tmp_path), so slug allocation, the doc shape and disk I/O are
all covered without a live MongoDB.
"""
import json

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

from qwen_tts.serve import model as model_mod
from qwen_tts.serve.share.config import ShareConfig
from qwen_tts.serve.share.routes import build_router
from qwen_tts.serve.share.state import ShareState
from qwen_tts.serve.share.store import ShareStore


# --- minimal async Mongo fake ------------------------------------------------
class _Result:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, key, direction=1):
        self.docs.sort(key=lambda d: (d.get(key) is None, d.get(key)))
        return self

    async def to_list(self, length=None):
        return self.docs


class _FakeCollection:
    def __init__(self):
        self.docs = []

    async def index_information(self):
        return {}

    async def create_index(self, keys, **kw):
        return "idx"

    async def insert_one(self, doc):
        if any(d["slug"] == doc["slug"] for d in self.docs):
            raise DuplicateKeyError("dup slug")
        self.docs.append(dict(doc))
        return _Result(inserted_id="x")

    async def find_one(self, flt):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                return dict(d)
        return None

    def find(self, flt):
        return _Cursor([dict(d) for d in self.docs if all(d.get(k) == v for k, v in flt.items())])

    async def update_one(self, flt, update):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                d.update(update["$set"])
                return _Result(modified_count=1)
        return _Result(modified_count=0)

    async def delete_one(self, flt):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in flt.items())]
        return _Result(deleted_count=before - len(self.docs))


class _FakeDB:
    def __init__(self, coll):
        self._coll = coll

    def __getitem__(self, name):
        return self._coll


def _make_client(tmp_path, *, enabled=True):
    store = ShareStore(_FakeDB(_FakeCollection()), str(tmp_path), "tts_share_works")
    cfg = ShareConfig(enabled=enabled, shared_dir=str(tmp_path), regen_max_chars=50,
                      regen_rate_per_min=3)
    state = ShareState(cfg, store=store)
    app = FastAPI()
    app.state.share_state = state
    app.include_router(build_router())
    return TestClient(app), store


def _publish(client, *, dimension="voice", variants=None):
    variants = variants or [
        {"id": "v0", "label": "vivian", "voice": "vivian"},
        {"id": "v1", "label": "ryan", "voice": "ryan"},
    ]
    meta = {"text": "今天天气真好", "dimension": dimension, "variants": variants}
    files = {f"audio_{v['id']}": (f"{v['id']}.wav", b"RIFFfakewavbytes", "audio/wav")
             for v in variants}
    return client.post("/v1/share/publish", data={"metadata": json.dumps(meta)}, files=files)


# --- tests -------------------------------------------------------------------
def test_publish_then_fetch_and_stream_audio(tmp_path):
    client, _ = _make_client(tmp_path)
    r = _publish(client)
    assert r.status_code == 200
    slug = r.json()["slug"]
    assert len(slug) == 8
    assert r.json()["url"] == f"/share/{slug}"

    got = client.get(f"/v1/share/{slug}")
    assert got.status_code == 200
    body = got.json()
    assert body["text"] == "今天天气真好"
    assert body["dimension"] == "voice"
    assert [v["audio_url"] for v in body["variants"]] == [
        f"/v1/share/{slug}/audio/v0", f"/v1/share/{slug}/audio/v1"]
    # internal audio_path must NOT leak to clients
    assert all("audio_path" not in v for v in body["variants"])

    audio = client.get(f"/v1/share/{slug}/audio/v0")
    assert audio.status_code == 200
    assert audio.content == b"RIFFfakewavbytes"
    assert audio.headers["content-type"] == "audio/wav"


def test_unknown_slug_404(tmp_path):
    client, _ = _make_client(tmp_path)
    assert client.get("/v1/share/nope1234").status_code == 404
    assert client.get("/v1/share/nope1234/audio/v0").status_code == 404


def test_publish_missing_audio_422(tmp_path):
    client, _ = _make_client(tmp_path)
    meta = {"text": "x", "dimension": "voice", "variants": [{"id": "v0", "label": "a"}]}
    r = client.post("/v1/share/publish", data={"metadata": json.dumps(meta)})  # no files
    assert r.status_code == 422


def test_publish_bad_dimension_422(tmp_path):
    client, _ = _make_client(tmp_path)
    assert _publish(client, dimension="loudness").status_code == 422


def test_audio_variant_id_traversal_blocked(tmp_path):
    client, _ = _make_client(tmp_path)
    slug = _publish(client).json()["slug"]
    assert client.get(f"/v1/share/{slug}/audio/..%2f..%2fetc").status_code == 404


def test_gallery_lists_only_gallery_kind(tmp_path):
    client, store = _make_client(tmp_path)
    user_slug = _publish(client).json()["slug"]
    gal_slug = _publish(client).json()["slug"]
    # promote one work to the gallery (mutate the in-memory fake directly)
    for d in store.collection.docs:
        if d["slug"] == gal_slug:
            d.update({"kind": "gallery", "gallery_order": 0, "title": "9 音色巡礼"})

    items = client.get("/v1/gallery").json()["items"]
    slugs = [it["slug"] for it in items]
    assert gal_slug in slugs
    assert user_slug not in slugs
    assert items[0]["title"] == "9 音色巡礼"


def test_disabled_returns_404(tmp_path):
    client, _ = _make_client(tmp_path, enabled=False)
    assert _publish(client).status_code == 404
    assert client.get("/v1/gallery").status_code == 404


def test_regenerate_validation_and_happy_path(tmp_path, monkeypatch):
    client, _ = _make_client(tmp_path)
    slug = _publish(client).json()["slug"]

    # too-long text → 422
    long_text = "字" * 60
    assert client.post("/v1/share/regenerate",
                       json={"source_slug": slug, "new_text": long_text}).status_code == 422
    # unknown source → 404
    assert client.post("/v1/share/regenerate",
                       json={"source_slug": "zzzz0000", "new_text": "你好"}).status_code == 404

    # happy path with a stubbed model
    monkeypatch.setattr(model_mod, "is_ready", lambda: True)
    monkeypatch.setattr(model_mod, "generate",
                        lambda **kw: (np.zeros(24000, dtype=np.float32), 24000))
    r = client.post("/v1/share/regenerate", json={"source_slug": slug, "new_text": "你好世界"})
    assert r.status_code == 200
    data = r.json()
    assert data["text"] == "你好世界"
    assert len(data["variants"]) == 2
    assert all(v["audio_base64"] for v in data["variants"])
    assert data["variants"][0]["duration_ms"] == 1000


def test_regenerate_rate_limited(tmp_path, monkeypatch):
    client, _ = _make_client(tmp_path)
    slug = _publish(client).json()["slug"]
    monkeypatch.setattr(model_mod, "is_ready", lambda: True)
    monkeypatch.setattr(model_mod, "generate",
                        lambda **kw: (np.zeros(2400, dtype=np.float32), 24000))
    ok = 0
    for _ in range(5):
        if client.post("/v1/share/regenerate",
                       json={"source_slug": slug, "new_text": "嗨"}).status_code == 200:
            ok += 1
    # limit is 3/min → at most 3 succeed, rest 429
    assert ok == 3
