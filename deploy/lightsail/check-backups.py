#!/usr/bin/env python3
"""Read-only backup freshness and capacity evidence; never certifies restoration."""
import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import sys


def regular(path):
    return stat.S_ISREG(path.lstat().st_mode)


def check(directory, max_age_hours, min_free_bytes, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    result = {"version": 1, "status": "UNKNOWN", "issues": [],
              "restoreVerified": False, "integrityVerified": False}
    try:
        if not stat.S_ISDIR(directory.lstat().st_mode):
            raise ValueError("Invalid directory")
        free = shutil.disk_usage(directory).free
        result["freeBytes"] = free
        result["minimumFreeBytes"] = min_free_bytes
        result["maximumAgeHours"] = max_age_hours
        if free < min_free_bytes:
            result["issues"].append("LOW_DISK_SPACE")
        dates = []
        invalid = 0
        pending = 0
        with os.scandir(directory) as entries:
            for entry in entries:
                if entry.name.startswith(".pending-"):
                    pending += 1
                    continue
                if not entry.name.endswith(".backup"):
                    continue
                try:
                    if not entry.is_dir(follow_symlinks=False):
                        raise ValueError("Invalid bundle")
                    bundle = Path(entry.path)
                    manifest = bundle / "manifest.json"
                    sidecar = bundle / "database.dump.sha256"
                    archive = bundle / "database.dump"
                    if not all(regular(p) for p in (manifest, sidecar, archive)):
                        raise ValueError("Invalid files")
                    if manifest.stat().st_size > 8192 or sidecar.stat().st_size > 128:
                        raise ValueError("Oversized metadata")
                    data = json.loads(manifest.read_text())
                    if not isinstance(data, dict):
                        raise ValueError("Invalid metadata")
                    size = archive.stat().st_size
                    if (type(data.get("version")) is not int or data["version"] != 1
                            or type(data.get("bytes")) is not int or data["bytes"] != size or size <= 0
                            or data.get("archiveListing") != "PASSED"
                            or not isinstance(data.get("sha256"), str)
                            or not re.fullmatch(r"[a-f0-9]{64}", data["sha256"])
                            or sidecar.read_text().strip() != data["sha256"]):
                        raise ValueError("Inconsistent metadata")
                    completed = dt.datetime.fromisoformat(data["completedAt"])
                    if completed.tzinfo is None or completed > now:
                        raise ValueError("Invalid timestamp")
                    dates.append(completed)
                except (OSError, ValueError, KeyError, TypeError, OverflowError):
                    invalid += 1
        result.update(validMetadataBundles=len(dates), invalidBundles=invalid, pendingBundles=pending)
        if invalid:
            result["issues"].append("INVALID_BUNDLE_METADATA")
        if pending:
            result["issues"].append("PENDING_BACKUP")
        if not dates:
            result["issues"].append("NO_COMPLETED_BACKUP")
        else:
            age = (now - max(dates)).total_seconds() / 3600
            result["latestAgeHours"] = round(age, 3)
            if age > max_age_hours:
                result["issues"].append("STALE_BACKUP")
        result["status"] = "ATTENTION" if result["issues"] else "HEALTHY"
    except (OSError, ValueError):
        result["status"] = "UNKNOWN"
        result["issues"] = ["COLLECTION_FAILED"]
    return result


def positive_hours(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError("Use a finite positive number of hours")
    return number


def nonnegative_bytes(value):
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("Use a nonnegative byte count")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=Path("/var/backups/energiepad"))
    parser.add_argument("--max-age-hours", required=True, type=positive_hours)
    parser.add_argument("--min-free-bytes", required=True, type=nonnegative_bytes)
    args = parser.parse_args()
    result = check(args.directory, args.max_age_hours, args.min_free_bytes)
    print(json.dumps(result, sort_keys=True))
    return {"HEALTHY": 0, "ATTENTION": 1, "UNKNOWN": 2}[result["status"]]


if __name__ == "__main__":
    sys.exit(main())
