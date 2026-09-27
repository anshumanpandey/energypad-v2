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


class SourceManifestTests(unittest.TestCase):
    def fixture(self, root):
        (root / 'source.csv').write_bytes(b'private fixture,123\n')
        (root / 'schema.sql').write_bytes(b'CREATE TABLE fixture (value text);\n')
        return {'sourceSystem': 'synthetic local fixture', 'extractedAt': '2020-01-01T01:00:00+01:00',
                'scope': 'Synthetic site, January 2020', 'targetOrganisationId': '11111111-1111-4111-8111-111111111111',
                'files': [{'label': 'Export', 'role': 'export', 'path': str(root / 'source.csv')},
                          {'label': 'Schema', 'role': 'schema', 'path': str(root / 'schema.sql')}]}

    def test_exact_hashes_private_manifest_and_unchanged_originals(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            request = self.fixture(root)
            original = (root / 'source.csv').read_bytes()
            report = module.create_manifest(request, NOW)
            self.assertEqual(report['files'][0]['sha256'], hashlib.sha256(original).hexdigest())
            self.assertEqual(report['files'][0]['bytes'], len(original))
            self.assertEqual(report['extractedAt'], '2020-01-01T00:00:00+00:00')
            self.assertFalse(report['sourceIdentityVerified'])
            self.assertFalse(report['reconciliationApproved'])
            output = root / 'manifest.json'
            module.publish(report, output)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertEqual((root / 'source.csv').read_bytes(), original)
            self.assertNotIn('private fixture', output.read_text())
            self.assertEqual(list(root.glob('.source-manifest-*')), [])

    def test_output_collision_and_symlink_never_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            request = self.fixture(root)
            for output in (root / 'source.csv', root / 'link.json'):
                if output.name == 'link.json': output.symlink_to(root / 'source.csv')
                with self.assertRaises(FileExistsError): module.publish(module.create_manifest(request, NOW), output)
                self.assertEqual((root / 'source.csv').read_bytes(), b'private fixture,123\n')
            self.assertEqual(list(root.glob('.source-manifest-*')), [])

    def test_invalid_identity_inventory_and_times(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            request = self.fixture(root)
            for field, value in [('extractedAt', '2020-01-01'), ('extractedAt', '2999-01-01T00:00:00Z'),
                                 ('targetOrganisationId', 'bad'), ('scope', ''), ('files', []), ('unexpected', True)]:
                with self.subTest(field=field, value=value), self.assertRaises((ValueError, TypeError)):
                    module.create_manifest({**request, field: value}, NOW)
            request['files'][1]['role'] = 'export'
            with self.assertRaises(ValueError): module.create_manifest(request, NOW)

    def test_symlink_empty_directory_and_duplicate_inode_are_rejected(self):
        for fault in ('symlink', 'empty', 'directory', 'duplicate', 'relative'):
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                request = self.fixture(root)
                source = root / 'source.csv'
                if fault == 'symlink':
                    source.unlink(); source.symlink_to(root / 'schema.sql')
                if fault == 'empty': source.write_bytes(b'')
                if fault == 'directory': source.unlink(); source.mkdir()
                if fault == 'duplicate':
                    (root / 'schema.sql').unlink(); os.link(source, root / 'schema.sql')
                if fault == 'relative': request['files'][0]['path'] = 'source.csv'
                with self.assertRaises((OSError, ValueError)): module.create_manifest(request, NOW)

    def test_mid_hash_change_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            request = self.fixture(root)
            actual = module.hashlib.file_digest
            def changed(source, algorithm):
                digest = actual(source, algorithm)
                with (root / 'source.csv').open('ab') as out: out.write(b'changed')
                return digest
            with patch.object(module.hashlib, 'file_digest', side_effect=changed):
                with self.assertRaises(ValueError): module.create_manifest(request, NOW)

    def test_cli_sanitizes_failures_and_bounds_request(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            request = self.fixture(root)
            input_path = root / 'request.json'
            output = root / 'output.json'
            for content in ('{"scope":1,"scope":2}', 'x' * 65537, json.dumps({**request, 'scope': ''})):
                input_path.write_text(content)
                run = subprocess.run([sys.executable, module.__file__, '--request', str(input_path), '--output', str(output)], capture_output=True, text=True)
                self.assertEqual(run.returncode, 1)
                self.assertFalse(output.exists())
                self.assertNotIn(str(root), run.stderr)
            input_path.write_text(json.dumps(request))
            run = subprocess.run([sys.executable, module.__file__, '--request', str(input_path), '--output', str(output)], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertTrue(output.exists())


if __name__ == '__main__':
    unittest.main()
