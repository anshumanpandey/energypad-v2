import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("diagnose", Path(__file__).with_name("diagnose.py"))
diagnose = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnose)


def healthy(service):
    return {"service": service, "state": "running", "paused": False,
            "oomKilled": False, "restarts": 0, "health": "healthy"}


class DiagnosticsTests(unittest.TestCase):
    def test_healthy_and_restart_counts(self):
        rows = [healthy(service) for service in diagnose.SERVICES]
        rows[0]["restarts"] = 2
        report = diagnose.summarize(rows)
        self.assertEqual(report["status"], "HEALTHY")
        self.assertEqual(report["services"][0]["restartCount"], 2)

    def test_missing_or_partial_deployment(self):
        report = diagnose.summarize([healthy("db")])
        self.assertEqual(report["status"], "ATTENTION")
        self.assertEqual(report["services"][1]["issues"], ["MISSING_CONTAINER"])

    def test_failures_and_unknown_values(self):
        for field, value, issue in [
            ("state", "exited", "NOT_RUNNING"), ("paused", True, "NOT_RUNNING"),
            ("oomKilled", True, "OOM_OR_UNKNOWN"), ("health", "starting", "HEALTH_STARTING"),
            ("health", "not_configured", "HEALTH_NOT_CONFIGURED"),
            ("health", "unhealthy", "UNHEALTHY_OR_UNKNOWN"),
            ("health", "private-secret", "UNHEALTHY_OR_UNKNOWN"),
            ("restarts", -1, "INVALID_RESTART_COUNT"),
        ]:
            with self.subTest(field=field, value=value):
                row = {**healthy("web"), field: value}
                report = diagnose.summarize([healthy("db"), row, healthy("worker")])
                self.assertIn(issue, report["services"][1]["issues"])
                self.assertNotIn("private-secret", json.dumps(report))

    def test_every_replica_must_be_healthy(self):
        rows = [healthy(service) for service in diagnose.SERVICES]
        rows.append({**healthy("worker"), "health": "unhealthy"})
        self.assertEqual(diagnose.summarize(rows)["status"], "ATTENTION")

    def test_commands_are_scoped_readonly_and_projected(self):
        calls = []
        def run(args, **kwargs):
            calls.append((args, kwargs))
            output = "a" * 64 if args[1] == "ps" else json.dumps(healthy("db"))
            return subprocess.CompletedProcess(args, 0, output, "")
        self.assertEqual(diagnose.collect(run), [healthy("db")])
        self.assertIn("label=com.docker.compose.project=energiepad", calls[0][0])
        self.assertIn("label=com.docker.compose.oneoff=False", calls[0][0])
        self.assertEqual(calls[1][0][1:3], ["inspect", "--format"])
        for _, options in calls:
            self.assertEqual(options["timeout"], 15)
        self.assertNotIn(".Config.Env", diagnose.PROJECTION)
        self.assertNotIn(".Health.Log", diagnose.PROJECTION)

    def test_bad_inventory_is_rejected_before_inspection(self):
        def run(args, **kwargs):
            return subprocess.CompletedProcess(args, 0, "--private-option", "")
        with self.assertRaises(ValueError):
            diagnose.collect(run)

    def test_collection_failure_is_sanitized_and_nonzero(self):
        for error in [PermissionError("private-secret"), subprocess.TimeoutExpired("docker", 15)]:
            output = io.StringIO()
            with patch.object(diagnose, "collect", side_effect=error), patch("sys.argv", ["diagnose.py"]), contextlib.redirect_stdout(output):
                self.assertEqual(diagnose.main(), 2)
            report = json.loads(output.getvalue())
            self.assertEqual(report["status"], "UNKNOWN")
            self.assertNotIn("private-secret", output.getvalue())


if __name__ == "__main__":
    unittest.main()
