#!/usr/bin/env python3
"""Mantém as N cópias mais novas de cada classe de retenção no R2."""

import json
import os
import subprocess
import sys


BUCKET = os.environ["R2_BUCKET"]
LIMITS = {"daily/": 7, "weekly/": 4, "monthly/": 6}


def aws(*arguments: str) -> str:
    completed = subprocess.run(
        ["aws", *arguments], check=True, text=True, capture_output=True
    )
    return completed.stdout


def main() -> int:
    response = json.loads(
        aws("s3api", "list-objects-v2", "--bucket", BUCKET, "--output", "json")
    )
    keys = [item["Key"] for item in response.get("Contents", [])]
    for prefix, keep in LIMITS.items():
        candidates = sorted((key for key in keys if key.startswith(prefix)), reverse=True)
        for key in candidates[keep:]:
            aws("s3api", "delete-object", "--bucket", BUCKET, "--key", key)
            print(f"removido={key}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"Falha ao aplicar retenção no R2: {error}", file=sys.stderr)
        raise SystemExit(1)
