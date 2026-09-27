#!/usr/bin/env python3
"""Read-only Docker diagnostics. Never collect environment variables or logs."""
import datetime
import json
import re
import subprocess
import sys

SERVICES = ("db", "web", "worker")
PROJECTION = '''{"service":{{json (index .Config.Labels "com.docker.compose.service")}},"state":{{json .State.Status}},"paused":{{json .State.Paused}},"oomKilled":{{json .State.OOMKilled}},"restarts":{{json .RestartCount}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}"not_configured"{{end}}}'''


def collect(run=subprocess.run):
    def docker(*args):
        result = run(["docker", *args], capture_output=True, text=True, timeout=15, check=True)
        return result.stdout

    ids = docker("ps", "--all", "--quiet", "--no-trunc", "--filter",
                 "label=com.docker.compose.project=energiepad", "--filter",
                 "label=com.docker.compose.oneoff=False").split()
    if len(ids) > 100 or any(not re.fullmatch(r"[a-f0-9]{64}", value) for value in ids):
        raise ValueError("Invalid container inventory")
    if not ids:
        return []
    return [json.loads(line) for line in docker("inspect", "--format", PROJECTION, *ids).splitlines()]


def summarize(rows):
    services = []
    for service in SERVICES:
        matching = [row for row in rows if row.get("service") == service]
        issues = set()
        if not matching:
            issues.add("MISSING_CONTAINER")
        restarts = 0
        for row in matching:
            if row.get("state") != "running" or row.get("paused") is not False:
                issues.add("NOT_RUNNING")
            if row.get("oomKilled") is not False:
                issues.add("OOM_OR_UNKNOWN")
            health = row.get("health")
            if health == "starting":
                issues.add("HEALTH_STARTING")
            elif health == "not_configured":
                issues.add("HEALTH_NOT_CONFIGURED")
            elif health != "healthy":
                issues.add("UNHEALTHY_OR_UNKNOWN")
            count = row.get("restarts")
            if type(count) is not int or count < 0:
                issues.add("INVALID_RESTART_COUNT")
            else:
                restarts += count
        services.append({"service": service, "status": "ATTENTION" if issues else "HEALTHY",
                         "containers": len(matching), "restartCount": restarts, "issues": sorted(issues)})
    return {"status": "ATTENTION" if any(s["issues"] for s in services) else "HEALTHY",
            "services": services}


def main():
    if len(sys.argv) != 1:
        print("Usage: python3 diagnose.py", file=sys.stderr)
        return 2
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        report = summarize(collect())
    except (OSError, subprocess.SubprocessError, ValueError, TypeError, AttributeError):
        # Docker errors may include private paths or configuration; never echo them.
        report = {"status": "UNKNOWN", "code": "DOCKER_DIAGNOSTICS_UNAVAILABLE"}
    print(json.dumps({"version": 1, "checkedAt": timestamp, **report}, indent=2))
    return {"HEALTHY": 0, "ATTENTION": 1, "UNKNOWN": 2}[report["status"]]


if __name__ == "__main__":
    sys.exit(main())
