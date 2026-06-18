#!/usr/bin/env python3
"""Seed the public gallery with curated comparison works.

For each scenario it generates the audio via the *running* customvoice backend
(``/v1/tts``), publishes it as a share work (``/v1/share/publish``), then promotes
the work to ``kind='gallery'`` directly in Mongo — there is no public promote
endpoint by design, so injecting gallery content stays an operator-only action.

Usage (matching how the backend was started):

    python scripts/seed-gallery.py \
        --base-url http://localhost:4970 \
        --mongo-url mongodb://10.0.0.93:27017 \
        --db-name qwen_tts_featureloop --reset

Re-running with --reset is idempotent: it drops existing gallery works first.
"""
import argparse
import json
import sys
from pathlib import Path

import httpx
from pymongo import MongoClient


def generate(client: httpx.Client, base: str, text: str, speaker: str,
             language: str, instruct: str | None) -> bytes:
    payload = {"text": text, "speaker": speaker, "language": language or "Auto",
               "response_format": "wav"}
    if instruct:
        payload["instruct"] = instruct
    r = client.post(f"{base}/v1/tts", json=payload, timeout=600)
    r.raise_for_status()
    return r.content


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base-url", default="http://localhost:4970")
    ap.add_argument("--mongo-url", default="mongodb://localhost:27017")
    ap.add_argument("--db-name", default="conference_ws")
    ap.add_argument("--collection", default="tts_share_works")
    ap.add_argument("--scenarios", default=str(Path(__file__).parent / "gallery-scenarios.json"))
    ap.add_argument("--reset", action="store_true", help="remove existing gallery works first")
    args = ap.parse_args()

    scenarios = json.loads(Path(args.scenarios).read_text(encoding="utf-8"))
    coll = MongoClient(args.mongo_url)[args.db_name][args.collection]

    if args.reset:
        n = coll.delete_many({"kind": "gallery"}).deleted_count
        print(f"[seed] removed {n} existing gallery work(s)")

    with httpx.Client() as client:
        for order, sc in enumerate(scenarios):
            files = {}
            for v in sc["variants"]:
                audio = generate(client, args.base_url, v.get("text", sc["text"]),
                                 v["voice"], v.get("language", "Auto"), v.get("instruct"))
                files[f"audio_{v['id']}"] = (f"{v['id']}.wav", audio, "audio/wav")
                print(f"[seed] {sc['title']} · {v['label']} ({len(audio)} B)")

            meta = {
                "text": sc["text"],
                "dimension": sc["dimension"],
                # Keep per-variant `text` (multilingual translations) so each column
                # shows its own sentence; other scenarios simply omit it.
                "variants": [dict(v) for v in sc["variants"]],
            }
            r = client.post(f"{args.base_url}/v1/share/publish",
                            data={"metadata": json.dumps(meta, ensure_ascii=False)},
                            files=files, timeout=120)
            r.raise_for_status()
            slug = r.json()["slug"]
            coll.update_one({"slug": slug},
                            {"$set": {"kind": "gallery", "gallery_order": order, "title": sc["title"]}})
            print(f"[seed] published + promoted: {sc['title']} → /gallery/{slug}")

    print("[seed] done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
