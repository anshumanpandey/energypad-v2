#!/usr/bin/env python3
"""Record original migration source identity without parsing or importing source data."""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
from pathlib import Path
import stat
import sys
import tempfile
import uuid


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate field')
        result[key] = value
    return result


def text(value, limit=200):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError('Invalid text')
    return value.strip()


def validate(request, now):
    required = {'sourceSystem', 'extractedAt', 'scope', 'targetOrganisationId', 'files'}
    if not isinstance(request, dict) or set(request) != required:
        raise ValueError('Invalid fields')
    source = text(request['sourceSystem'])
    scope = text(request['scope'], 2000)
    extracted = dt.datetime.fromisoformat(text(request['extractedAt']))
    if extracted.tzinfo is None or extracted > now:
        raise ValueError('Invalid extraction time')
    target = str(uuid.UUID(request['targetOrganisationId']))
    files = request['files']
    if not isinstance(files, list) or not 2 <= len(files) <= 100:
        raise ValueError('Invalid file inventory')
    labels = set()
    roles = set()
    normalized = []
    for item in files:
        if not isinstance(item, dict) or set(item) != {'label', 'role', 'path'}:
            raise ValueError('Invalid file descriptor')
        label = text(item['label'])
        role = item['role']
        if role not in ('export', 'schema') or label in labels:
            raise ValueError('Invalid role or duplicate label')
        path = Path(text(item['path'], 4096))
        if not path.is_absolute():
            raise ValueError('Source paths must be absolute')
        labels.add(label)
        roles.add(role)
        normalized.append({'label': label, 'role': role, 'path': str(path)})
    if roles != {'export', 'schema'}:
        raise ValueError('Both export and schema are required')
    return {'sourceSystem': source, 'scope': scope, 'targetOrganisationId': target,
            'extractedAt': extracted.astimezone(dt.timezone.utc).isoformat(), 'files': normalized}


def signature(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def hash_source(path):
    # Reject final-component symlinks and nonregular inputs before reading bytes.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as source:
        before = os.fstat(source.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_size <= 0:
            raise ValueError('Source must be a nonempty regular file')
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
        after = os.fstat(source.fileno())
        current = os.stat(path, follow_symlinks=False)
        if signature(before) != signature(after) or signature(before) != signature(current):
            raise ValueError('Source changed during hashing')
    return {'bytes': before.st_size, 'sha256': digest}, (before.st_dev, before.st_ino)


def create_manifest(request, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    validated = validate(request, now)
    identities = set()
    files = []
    for item in validated.pop('files'):
        evidence, identity = hash_source(item['path'])
        if identity in identities:
            raise ValueError('The same file was listed more than once')
        identities.add(identity)
        files.append({**item, **evidence})
    return {'version': 1, 'recordedAt': now.isoformat(), **validated, 'files': files,
            'sourceIdentityVerified': False, 'reconciliationApproved': False,
            'sourcePreservation': 'Original files must be retained separately; this manifest is not a backup.'}


def publish(report, output):
    # Link a completed private temporary file into place exclusively: no partial
    # manifest appears at the requested path and an existing target is never replaced.
    fd, temporary = tempfile.mkstemp(prefix='.source-manifest-', dir=output.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as destination:
            json.dump(report, destination, indent=2, ensure_ascii=True)
            destination.write('\n')
            destination.flush()
            os.fsync(destination.fileno())
        os.link(temporary, output, follow_symlinks=False)
        directory = os.open(output.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        os.unlink(temporary)


def verify_manifest(manifest, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    required = {'version', 'recordedAt', 'sourceSystem', 'extractedAt', 'scope',
                'targetOrganisationId', 'files', 'sourceIdentityVerified',
                'reconciliationApproved', 'sourcePreservation'}
    if (not isinstance(manifest, dict) or set(manifest) != required
            or type(manifest['version']) is not int or manifest['version'] != 1
            or manifest['sourceIdentityVerified'] is not False
            or manifest['reconciliationApproved'] is not False):
        raise ValueError('Invalid manifest contract')
    recorded = dt.datetime.fromisoformat(text(manifest['recordedAt']))
    if recorded.tzinfo is None or recorded > now:
        raise ValueError('Invalid manifest time')
    text(manifest['sourcePreservation'], 2000)
    files = manifest['files']
    if not isinstance(files, list) or not 2 <= len(files) <= 100:
        raise ValueError('Invalid files')
    for item in files:
        if (not isinstance(item, dict) or set(item) != {'label', 'role', 'path', 'bytes', 'sha256'}
                or type(item['bytes']) is not int or item['bytes'] <= 0
                or not isinstance(item['sha256'], str)
                or not re.fullmatch(r'[a-f0-9]{64}', item['sha256'])):
            raise ValueError('Invalid file evidence')
    # Validate the complete contract before opening any referenced source path.
    request = {key: manifest[key] for key in ('sourceSystem', 'extractedAt', 'scope', 'targetOrganisationId')}
    request['files'] = [{key: item[key] for key in ('label', 'role', 'path')} for item in files]
    validate(request, recorded)
    checks = []
    identities = set()
    for index, item in enumerate(files):
        try:
            evidence, identity = hash_source(item['path'])
            if identity in identities:
                status = 'DUPLICATE_SOURCE'
            else:
                status = 'MATCHED' if evidence == {key: item[key] for key in ('bytes', 'sha256')} else 'CHANGED'
            identities.add(identity)
        except (OSError, ValueError):
            status = 'UNAVAILABLE_OR_UNSTABLE'
        checks.append({'fileIndex': index, 'status': status})
    return {'version': 1, 'status': 'MATCHED' if all(c['status'] == 'MATCHED' for c in checks) else 'ATTENTION',
            'checkedAt': now.isoformat(), 'files': checks,
            'sourceIdentityVerified': False, 'reconciliationApproved': False}


def load_json(path, limit):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as source:
        before = os.fstat(source.fileno())
        if not stat.S_ISREG(before.st_mode):
            raise ValueError('Metadata must be a regular file')
        raw = source.read(limit + 1)
        if len(raw) > limit or signature(before) != signature(os.fstat(source.fileno())):
            raise ValueError('Metadata too large or changed')
    return json.loads(raw, object_pairs_hook=unique_object), raw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--request', type=Path)
    mode.add_argument('--verify', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.verify:
        if args.output:
            parser.error('--output is only used when creating a manifest')
        try:
            manifest, raw = load_json(args.verify, 1048576)
            result = verify_manifest(manifest)
            result['manifestSha256'] = hashlib.sha256(raw).hexdigest()
        except (OSError, ValueError, TypeError, AttributeError, OverflowError, RecursionError):
            print(json.dumps({'version': 1, 'status': 'INVALID_OR_UNAVAILABLE_MANIFEST'}))
            return 2
        print(json.dumps(result, sort_keys=True))
        return 0 if result['status'] == 'MATCHED' else 1
    if not args.output:
        parser.error('--output is required when creating a manifest')
    try:
        # Bound request metadata only; originals are streamed without truncation.
        request, _ = load_json(args.request, 65536)
        report = create_manifest(request)
        publish(report, args.output)
    except (OSError, ValueError, TypeError, AttributeError, OverflowError, RecursionError):
        print('Source manifest not confirmed. Check the request, stable readable originals and an unused output path.', file=sys.stderr)
        return 1
    print('Private source manifest created. Identity, mapping and reconciliation review remain required.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
