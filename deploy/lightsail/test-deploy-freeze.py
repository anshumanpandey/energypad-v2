"""Run the deployment shell with temporary paths and a fake Docker binary."""
import gzip
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class DeploymentFreezeTests(unittest.TestCase):
    def test_frozen_failure_never_rolls_back_to_an_older_image(self):
        for flag in ["true", "invalid", "false"]:
            with self.subTest(flag=flag), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                config = root / "config"
                config.mkdir()
                (config / "runtime.env").write_text("DEPLOYMENT_MODE=ip-preview\nAUTH_URL=http://127.0.0.1\nDATABASE_URL=fixture\nAUTH_SECRET=fixture\nOPEN_METEO_API_KEY=fixture\nAPP_WRITE_FREEZE=" + flag + "\n")
                for name in ["database.env", "migration.env"]:
                    (config / name).write_text("fixture")
                (root / "release.env").write_text("APP_IMAGE=energiepad-v2:" + "b" * 40)
                backup = root / "backup"
                backup.write_text("#!/bin/sh\nexit 0\n")
                backup.chmod(0o700)
                log = root / "calls.jsonl"
                docker = root / "docker"
                docker.write_text('''#!/usr/bin/env python3
import json, os, sys
args=sys.argv[1:]
with open(os.environ["TEST_DOCKER_LOG"],"a") as f:
    f.write(json.dumps({"args":args,"image":os.environ.get("APP_IMAGE")})+"\\n")
if args[:2] == ["image", "ls"]:
    for tag in ["c", "d", "e", "b", "a", "f"]:
        print("energiepad-v2:" + tag * 40)
    print("energiepad-v2:deployment-check")
if "load" in args or "psql" in " ".join(args): sys.stdin.read()
if "web" in args and os.environ.get("APP_IMAGE","").endswith("a"*40): sys.exit(1)
''')
                docker.chmod(0o700)
                source = Path(__file__).with_name("deploy.sh").read_text()
                source = source.replace("/var/lock/energiepad-deploy.lock", str(root / "lock"))
                source = source.replace("/opt/energiepad", str(root)).replace("/etc/energiepad", str(config))
                source = source.replace("/usr/local/sbin/energiepad-backup", str(backup))
                script = root / "deploy.sh"
                script.write_text(source)
                result = subprocess.run(["bash",str(script),"a"*40], input=gzip.compress(b"fixture image"),
                    env={**os.environ,"PATH":f"{root}:{os.environ['PATH']}","TEST_DOCKER_LOG":str(log)},
                    capture_output=True, timeout=10)
                self.assertEqual(result.returncode,1)
                calls=[json.loads(line) for line in log.read_text().splitlines()]
                removed=[c["args"] for c in calls if c["args"][:2] == ["image", "rm"]]
                self.assertEqual(removed, [["image", "rm", "energiepad-v2:" + "f" * 40]])
                self.assertLess(next(i for i,c in enumerate(calls) if c["args"][:2] == ["image", "rm"]),
                                next(i for i,c in enumerate(calls) if c["args"][:2] == ["image", "load"]))
                rollbacks=[c for c in calls if "web" in c["args"] and c["image"].endswith("b"*40)]
                self.assertEqual(len(rollbacks),1 if flag=="false" else 0)
                self.assertEqual((root / "release.env").read_text(),"APP_IMAGE=energiepad-v2:"+"b"*40)


if __name__ == "__main__": unittest.main()
