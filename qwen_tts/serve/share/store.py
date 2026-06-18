import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from pymongo.errors import DuplicateKeyError

from .models import PublishMetadata, is_valid_variant_id, new_slug

log = logging.getLogger(__name__)


class ShareStore:
    """Mongo (metadata) + local disk (audio) backing for share works.

    Audio bytes live at ``shared_dir/<slug>/<variant_id>.wav``; the Mongo doc
    stores only the relative ``audio_path`` so backups/CDNs can move files
    independently of the database.
    """

    def __init__(self, db, shared_dir: str, collection: str = "tts_share_works"):
        self.collection = db[collection]
        self.shared_dir = Path(shared_dir)

    async def ensure_indexes(self) -> None:
        existing = await self.collection.index_information()
        if not any(spec.get("key") == [("slug", 1)] for spec in existing.values()):
            await self.collection.create_index([("slug", 1)], unique=True, name="idx_slug_unique")
        if not any(
            spec.get("key") == [("kind", 1), ("gallery_order", 1)] for spec in existing.values()
        ):
            await self.collection.create_index(
                [("kind", 1), ("gallery_order", 1)], name="idx_kind_order"
            )

    def _variant_records(self, meta: PublishMetadata, slug: str):
        records = []
        for v in meta.variants:
            if not is_valid_variant_id(v.id):
                raise ValueError(f"invalid variant id: {v.id!r}")
            rec = v.model_dump()
            rec["audio_path"] = f"{slug}/{v.id}.wav"
            records.append(rec)
        return records

    async def create_work(
        self,
        meta: PublishMetadata,
        audio_by_variant: Dict[str, bytes],
        *,
        kind: str = "user",
        created_by: Optional[str] = None,
        gallery_order: Optional[int] = None,
        title: Optional[str] = None,
    ) -> str:
        missing = [v.id for v in meta.variants if v.id not in audio_by_variant]
        if missing:
            raise ValueError(f"missing audio for variants: {missing}")

        # Reserve a unique slug in Mongo first, then write the audio files; on a
        # slug collision retry before touching disk.
        last_exc: Optional[Exception] = None
        for _ in range(5):
            slug = new_slug()
            records = self._variant_records(meta, slug)
            doc = {
                "slug": slug,
                "text": meta.text,
                "dimension": meta.dimension,
                "variants": records,
                "created_at": datetime.now(timezone.utc),
                "public": True,
                "kind": kind,
                "gallery_order": gallery_order,
                "created_by": created_by,
                "title": title,
            }
            try:
                await self.collection.insert_one(doc)
            except DuplicateKeyError as exc:
                last_exc = exc
                continue
            self._write_audio(slug, meta, audio_by_variant)
            return slug
        raise RuntimeError(f"could not allocate a unique slug: {last_exc}")

    def _write_audio(self, slug: str, meta: PublishMetadata, audio_by_variant: Dict[str, bytes]):
        work_dir = self.shared_dir / slug
        work_dir.mkdir(parents=True, exist_ok=True)
        for v in meta.variants:
            (work_dir / f"{v.id}.wav").write_bytes(audio_by_variant[v.id])

    async def get_work(self, slug: str) -> Optional[dict]:
        return await self.collection.find_one({"slug": slug, "public": True})

    def audio_file(self, slug: str, variant_id: str) -> Optional[Path]:
        if not is_valid_variant_id(variant_id):
            return None
        path = self.shared_dir / slug / f"{variant_id}.wav"
        return path if path.is_file() else None

    async def list_gallery(self) -> List[dict]:
        cursor = self.collection.find({"kind": "gallery", "public": True}).sort("gallery_order", 1)
        return await cursor.to_list(length=200)

    async def promote_to_gallery(
        self, slug: str, gallery_order: int, title: Optional[str] = None
    ) -> bool:
        updates = {"kind": "gallery", "gallery_order": gallery_order}
        if title is not None:
            updates["title"] = title
        result = await self.collection.update_one({"slug": slug}, {"$set": updates})
        return result.modified_count > 0

    async def delete_work(self, slug: str) -> bool:
        result = await self.collection.delete_one({"slug": slug})
        shutil.rmtree(self.shared_dir / slug, ignore_errors=True)
        return result.deleted_count > 0
