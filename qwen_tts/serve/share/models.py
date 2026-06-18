import re
import secrets
import string
from typing import List, Optional

from pydantic import BaseModel, Field

_SLUG_ALPHABET = string.ascii_lowercase + string.digits
VALID_DIMENSIONS = ("voice", "emotion", "language", "temperature", "speed")
_VARIANT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")


def new_slug(length: int = 8) -> str:
    return "".join(secrets.choice(_SLUG_ALPHABET) for _ in range(length))


def is_valid_variant_id(variant_id: str) -> bool:
    """Guards the on-disk path component against traversal / odd characters."""
    return bool(_VARIANT_ID_RE.match(variant_id or ""))


class ShareVariant(BaseModel):
    """One column of a comparison: its label + the params that produced it.

    ``audio_path`` is server-internal (relative to shared_dir) and never leaves
    the backend — clients get an ``audio_url`` on the *Out variant instead."""

    id: str
    label: str
    voice: Optional[str] = None
    language: Optional[str] = None
    emotion: Optional[str] = None
    instruct: Optional[str] = None
    temperature: Optional[float] = None
    speed: Optional[float] = None
    duration_ms: Optional[int] = None


class PublishMetadata(BaseModel):
    """The JSON half of the multipart publish request (audio rides alongside)."""

    text: str = Field(min_length=1, max_length=2000)
    dimension: str
    variants: List[ShareVariant] = Field(min_length=1, max_length=12)


class ShareVariantOut(ShareVariant):
    audio_url: str


class ShareWorkOut(BaseModel):
    slug: str
    text: str
    dimension: str
    variants: List[ShareVariantOut]
    kind: str = "user"
    created_at: Optional[str] = None
    gallery_order: Optional[int] = None
    title: Optional[str] = None


class GalleryResponse(BaseModel):
    items: List[ShareWorkOut]


class PublishResponse(BaseModel):
    slug: str
    url: str


class RegenerateRequest(BaseModel):
    source_slug: str
    new_text: str = Field(min_length=1)


class RegenerateVariantOut(BaseModel):
    id: str
    label: str
    audio_base64: str
    duration_ms: int


class RegenerateResponse(BaseModel):
    text: str
    variants: List[RegenerateVariantOut]


def audio_url(slug: str, variant_id: str) -> str:
    return f"/v1/share/{slug}/audio/{variant_id}"


def work_to_out(doc: dict) -> ShareWorkOut:
    """Mongo document → public response (adds per-variant audio_url, drops paths)."""
    slug = doc["slug"]
    created = doc.get("created_at")
    created_iso = created.isoformat() if hasattr(created, "isoformat") else created
    variants_out: List[ShareVariantOut] = []
    for v in doc.get("variants", []):
        data = {k: v.get(k) for k in ShareVariant.model_fields}
        data["audio_url"] = audio_url(slug, v["id"])
        variants_out.append(ShareVariantOut(**data))
    return ShareWorkOut(
        slug=slug,
        text=doc.get("text", ""),
        dimension=doc.get("dimension", ""),
        variants=variants_out,
        kind=doc.get("kind", "user"),
        created_at=created_iso,
        gallery_order=doc.get("gallery_order"),
        title=doc.get("title"),
    )
