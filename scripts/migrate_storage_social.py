#!/usr/bin/env python3
"""Copia apenas os buckets pertencentes ao 360social entre projetos Supabase."""

import json
import os
import tempfile
import urllib.error
import urllib.parse
import urllib.request


SOURCE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SOURCE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TARGET_URL = os.environ["SOCIAL360_TARGET_URL"].rstrip("/")
TARGET_KEY = os.environ["SOCIAL360_TARGET_SERVICE_ROLE_KEY"]
SOCIAL_BUCKETS = {
    "logos-instituicoes",
    "documentos-pessoas",
    "diretivas",
    "diretivas-audios",
    "fotos-equipe",
}


def headers(key, content_type="application/json"):
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": content_type}


def json_request(base, key, method, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(f"{base}{path}", data=data, headers=headers(key), method=method)
    with urllib.request.urlopen(req, timeout=180) as response:
        body = response.read()
        return json.loads(body) if body else None


def list_prefix(bucket, prefix=""):
    offset = 0
    while True:
        page = json_request(
            SOURCE_URL,
            SOURCE_KEY,
            "POST",
            f"/storage/v1/object/list/{urllib.parse.quote(bucket, safe='')}",
            {"prefix": prefix, "limit": 1000, "offset": offset,
             "sortBy": {"column": "name", "order": "asc"}},
        )
        if not page:
            return
        for entry in page:
            name = entry.get("name")
            if not name:
                continue
            full_name = f"{prefix}/{name}" if prefix else name
            if entry.get("metadata") is None:
                yield from list_prefix(bucket, full_name)
            else:
                yield full_name, entry.get("metadata") or {}
        if len(page) < 1000:
            return
        offset += len(page)


def copy_object(bucket, name, metadata):
    path = f"/{urllib.parse.quote(bucket, safe='')}/{urllib.parse.quote(name, safe='/')}"
    download = urllib.request.Request(
        f"{SOURCE_URL}/storage/v1/object/authenticated{path}", headers=headers(SOURCE_KEY)
    )
    content_type = metadata.get("mimetype") or "application/octet-stream"
    with urllib.request.urlopen(download, timeout=300) as source, tempfile.SpooledTemporaryFile(
        max_size=8 * 1024 * 1024
    ) as payload:
        while chunk := source.read(1024 * 1024):
            payload.write(chunk)
        payload.seek(0)
        upload = urllib.request.Request(
            f"{TARGET_URL}/storage/v1/object{path}",
            data=payload.read(),
            headers={**headers(TARGET_KEY, content_type), "x-upsert": "true"},
            method="POST",
        )
        with urllib.request.urlopen(upload, timeout=300):
            return


def main():
    source_buckets = {
        item["id"]: item for item in json_request(SOURCE_URL, SOURCE_KEY, "GET", "/storage/v1/bucket")
    }
    copied = 0
    for bucket in sorted(SOCIAL_BUCKETS):
        info = source_buckets.get(bucket)
        if not info:
            continue
        definition = {
            "id": bucket,
            "name": bucket,
            "public": bool(info.get("public")),
            "file_size_limit": info.get("file_size_limit"),
            "allowed_mime_types": info.get("allowed_mime_types"),
        }
        try:
            json_request(TARGET_URL, TARGET_KEY, "POST", "/storage/v1/bucket", definition)
        except urllib.error.HTTPError as error:
            if error.code != 409:
                raise
            json_request(TARGET_URL, TARGET_KEY, "PUT", f"/storage/v1/bucket/{bucket}", definition)
        for name, metadata in list_prefix(bucket):
            copy_object(bucket, name, metadata)
            copied += 1

    # O bucket compartilhado `fotos` continha somente inscrições do Modox.
    # No projeto novo ele nasce vazio e privado para futuras fotos do 360social.
    target_buckets = {
        item["id"] for item in json_request(TARGET_URL, TARGET_KEY, "GET", "/storage/v1/bucket")
    }
    if "fotos" not in target_buckets:
        json_request(
            TARGET_URL, TARGET_KEY, "POST", "/storage/v1/bucket",
            {"id": "fotos", "name": "fotos", "public": False,
             "file_size_limit": 524288, "allowed_mime_types": ["image/jpeg", "image/webp"]},
        )
    print(f"Objetos sociais copiados: {copied}")


if __name__ == "__main__":
    main()
