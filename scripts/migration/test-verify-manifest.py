import copy
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('source_manifest', Path(__file__).with_name('source-manifest.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
NOW = dt.datetime(2026, 9, 26, tzinfo=dt.timezone.utc)


class VerifyTests(unittest.TestCase):
    def fixture(self, root):
        for name in ('export', 'schema'): (root / name).write_bytes(b'private synthetic source')
        return module.create_manifest({'sourceSystem': 'private name', 'scope': 'private scope',
            'extractedAt': '2020-01-01T00:00:00Z', 'targetOrganisationId': '11111111-1111-4111-8111-111111111111',
            'files': [{'label': name, 'role': name, 'path': str(root / name)} for name in ('export', 'schema')]}, NOW)

    def test_matches_without_modification_or_private_output(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = self.fixture(root)
            result = module.verify_manifest(manifest, NOW)
            self.assertEqual(result['status'], 'MATCHED')
            self.assertFalse(result['reconciliationApproved'])
            self.assertFalse(result['sourceIdentityVerified'])
            self.assertNotIn('private', json.dumps(result))
            self.assertNotIn(str(root), json.dumps(result))
            self.assertEqual((root / 'export').read_bytes(), b'private synthetic source')

    def test_same_size_change_missing_and_symlink_fail(self):
        for fault in ('changed', 'missing', 'symlink', 'directory'):
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                manifest = self.fixture(root)
                source = root / 'export'
                if fault == 'changed': source.write_bytes(b'X' * source.stat().st_size)
                else:
                    source.unlink()
                    if fault == 'symlink': source.symlink_to(root / 'schema')
                    if fault == 'directory': source.mkdir()
                result = module.verify_manifest(manifest, NOW)
                self.assertEqual(result['status'], 'ATTENTION')
                self.assertEqual(result['files'][1]['status'], 'MATCHED')

    def test_invalid_metadata_is_rejected_before_file_reads(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest = self.fixture(Path(temp))
            for field, value in [('version', True), ('version', 2), ('reconciliationApproved', True),
                                 ('recordedAt', '2999-01-01T00:00:00Z'), ('recordedAt', '2019-01-01T00:00:00Z')]:
                with self.subTest(field=field), patch.object(module, 'hash_source') as hashed:
                    with self.assertRaises(ValueError): module.verify_manifest({**manifest, field: value}, NOW)
                    hashed.assert_not_called()
            for field, value in [('bytes', True), ('sha256', 'bad')]:
                invalid = copy.deepcopy(manifest)
                invalid['files'][1][field] = value
                with patch.object(module, 'hash_source') as hashed:
                    with self.assertRaises(ValueError): module.verify_manifest(invalid, NOW)
                    hashed.assert_not_called()

    def test_duplicate_identity_and_unstable_source_fail(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = self.fixture(root)
            (root / 'schema').unlink()
            os.link(root / 'export', root / 'schema')
            self.assertEqual(module.verify_manifest(manifest, NOW)['files'][1]['status'], 'DUPLICATE_SOURCE')
            with patch.object(module, 'hash_source', side_effect=ValueError('private changed path')):
                result = module.verify_manifest(manifest, NOW)
                self.assertEqual(result['status'], 'ATTENTION')
                self.assertNotIn('private', json.dumps(result))

    def test_cli_contract_digest_and_no_writes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = self.fixture(root)
            path = root / 'manifest.json'
            path.write_text(json.dumps(manifest))
            raw = path.read_bytes()
            def run(*extra):
                return subprocess.run([sys.executable, module.__file__, '--verify', str(path), *extra], capture_output=True, text=True)
            result = run()
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)['manifestSha256'], hashlib.sha256(raw).hexdigest())
            (root / 'export').write_bytes(b'changed')
            self.assertEqual(run().returncode, 1)
            self.assertEqual(path.read_bytes(), raw)
            self.assertEqual(run('--output', str(root / 'forbidden.json')).returncode, 2)
            self.assertFalse((root / 'forbidden.json').exists())
            for content in ('{"version":1,"version":1}', 'x' * 1048577, '{}'):
                path.write_text(content)
                result = run()
                self.assertEqual(result.returncode, 2)
                self.assertEqual(json.loads(result.stdout)['status'], 'INVALID_OR_UNAVAILABLE_MANIFEST')
                self.assertNotIn(str(root), result.stdout)


if __name__ == '__main__':
    unittest.main()
