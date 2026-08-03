#!/usr/bin/env python3
"""Exporta todos os objetos do Supabase Storage preservando bucket e caminho."""

import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request


BASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DESTINATION = pathlib.Path(os.environ["STORAGE_BACKUP_DIR"]).resolve()
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def request_json(method: str, path: str, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        f"{BASE_URL}{path}", data=data, headers=HEADERS, method=method
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def safe_target(bucket: str, object_name: str) -> pathlib.Path:
    relative = pathlib.PurePosixPath(bucket, object_name)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"Caminho inseguro recebido do Storage: {relative}")
    target = (DESTINATION / pathlib.Path(*relative.parts)).resolve()
    if DESTINATION not in target.parents:
        raise ValueError(f"Objeto fora do diretório de backup: {relative}")
    return target


def download(bucket: str, object_name: str) -> int:
    encoded_bucket = urllib.parse.quote(bucket, safe="")
    encoded_name = urllib.parse.quote(object_name, safe="/")
    request = urllib.request.Request(
        f"{BASE_URL}/storage/v1/object/authenticated/{encoded_bucket}/{encoded_name}",
        headers=HEADERS,
    )
    target = safe_target(bucket, object_name)
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(request, timeout=300) as response, target.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    return target.stat().st_size


def export_prefix(bucket: str, prefix: str = "") -> tuple[int, int]:
    objects = 0
    total_bytes = 0
    offset = 0
    encoded_bucket = urllib.parse.quote(bucket, safe="")
    while True:
        page = request_json(
            "POST",
            f"/storage/v1/object/list/{encoded_bucket}",
            {"prefix": prefix, "limit": 1000, "offset": offset, "sortBy": {"column": "name", "order": "asc"}},
        )
        if not page:
            break
        for entry in page:
            name = entry.get("name")
            if not name:
                continue
            object_name = f"{prefix}/{name}" if prefix else name
            if entry.get("metadata") is None:
                child_objects, child_bytes = export_prefix(bucket, object_name)
                objects += child_objects
                total_bytes += child_bytes
            else:
                total_bytes += download(bucket, object_name)
                objects += 1
        if len(page) < 1000:
            break
        offset += len(page)
    return objects, total_bytes


def main() -> int:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    buckets = request_json("GET", "/storage/v1/bucket")
    (DESTINATION / "buckets.json").write_text(
        json.dumps(buckets, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    summary = []
    for bucket in buckets:
        bucket_id = bucket["id"]
        count, size = export_prefix(bucket_id)
        summary.append({"bucket": bucket_id, "objects": count, "bytes": size})
        print(f"bucket={bucket_id} objects={count} bytes={size}")
    (DESTINATION / "storage-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError) as error:
        print(f"Falha no backup do Storage: {error}", file=sys.stderr)
        raise SystemExit(1)
