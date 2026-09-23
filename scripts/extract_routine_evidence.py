"""Read-only evidence for the two supplied routine workbooks; never recalculates or approves."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from extract_nra_evidence import read_cells

PROFILES = {
    '40dfaa6aaaeed910fa49552bab2d9ef629adf91b6982796372cf8f941e7821cd': 'single',
    '96d03f58b3caf94429f86b257ddb316cb4f3bf96f4e11cf8c3bbaf7a4c2a77cb': 'multi',
}


def extract(source):
    with Path(source).open('rb') as stream:
        content = stream.read(20_000_001)
    digest = hashlib.sha256(content).hexdigest()
    if digest not in PROFILES:
        raise ValueError('Unrecognized source hash; review layout before extraction.')
    region = 'A1:M67'
    return {
        'schemaVersion': 1, 'extractor': 'routine-source-evidence-v1',
        'approved': False, 'nativeRecalculationPerformed': False,
        'source': {'file': Path(source).name, 'sha256': digest, 'bytes': len(content),
                   'sheet': 'Regression Analysis', 'profile': PROFILES[digest]},
        'sections': {'worksheet': {'range': region, 'cells': read_cells(content, {'worksheet': region})}},
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('output')
    args = parser.parse_args()
    result = extract(args.source)
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False)
        stream.write('\n')
