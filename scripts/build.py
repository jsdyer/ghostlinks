"""Validate curated evidence and assemble the GitHub Pages directory."""

import json
import re
import shutil
from datetime import date, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "web"
OUTPUT = ROOT / "dist"


def check_url(value):
    url = urlsplit(value)
    if url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password:
        raise ValueError(f"Invalid evidence URL: {value}")
    return url


def validate(snapshot):
    if snapshot["version"] != 1 or not snapshot["cases"]:
        raise ValueError("Expected a nonempty version 1 record collection")
    date.fromisoformat(snapshot["date"])
    case_ids = set()
    for record in snapshot["cases"]:
        case_id = record["id"]
        if not re.fullmatch(r"[a-z0-9-]+", case_id) or case_id in case_ids:
            raise ValueError(f"Invalid or duplicated record ID: {case_id}")
        case_ids.add(case_id)
        check_url(record["url"])
        check_url(record["replacement"])
        check = record["checked"]
        check_url(check["requested"])
        check_url(check["final"])
        for hop in check["hops"]:
            check_url(hop["from"])
            check_url(hop["to"])
            if hop["code"] not in {301, 302, 303, 307, 308}:
                raise ValueError(f"{case_id} has an invalid redirect status")
        if not record["captures"]:
            raise ValueError(f"{case_id} has no capture evidence")
        stamps = set()
        for capture in record["captures"]:
            stamp = capture["date"]
            if len(stamp) != 14 or stamp in stamps:
                raise ValueError(f"{case_id} has an invalid or repeated timestamp")
            datetime.strptime(stamp, "%Y%m%d%H%M%S")
            stamps.add(stamp)
            check_url(capture["original"])
            replay = check_url(capture["archive"])
            source = check_url(capture["source"])
            params = parse_qs(source.query)
            if replay.netloc != "web.archive.org" or not replay.path.startswith(f"/web/{stamp}/"):
                raise ValueError(f"{case_id} has an unexpected replay address")
            if (source.netloc != "archive.org" or source.path != "/wayback/available"
                    or params.get("url") != [record["url"]]
                    or params.get("timestamp") != [capture["anchor"]]):
                raise ValueError(f"{case_id} has an unexpected capture receipt")


def main():
    snapshot = json.loads((SOURCE / "cases.json").read_text(encoding="utf-8"))
    validate(snapshot)
    shutil.copytree(SOURCE, OUTPUT, dirs_exist_ok=True)
    (OUTPUT / ".nojekyll").touch()
    total = sum(len(record["captures"]) for record in snapshot["cases"])
    print(f"Built {len(snapshot['cases'])} research files with {total} indexed captures.")


if __name__ == "__main__":
    main()
