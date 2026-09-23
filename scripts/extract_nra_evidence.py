"""Read-only, hash-pinned evidence extraction for the discovered NRA reference.

Uses only Python's standard library. This is not a spreadsheet recalculation
engine or a golden-result approval. Originals are never written.
"""
import argparse
from decimal import Decimal, localcontext
import hashlib
import io
import json
import os
from pathlib import Path
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile

SOURCE_HASH = '427df495d5858f091616ea3709125a305a2d7212ac6ce8ac5b54c9100f53caed'
MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS = {'m': MAIN}
SECTIONS = {
    'baseline': 'A5:M9', 'coefficients': 'A28:D29',
    'fittedAndResiduals': 'A34:M38', 'statistics': 'A40:M44',
    'coefficientTests': 'A48:M52', 'reporting': 'A57:M66',
    'hours': 'A70:M72', 'population': 'A75:M77',
    'nra': 'A80:M84', 'significance': 'A89:M96',
}


def column_number(value):
    result = 0
    for char in value:
        result = result * 26 + ord(char) - ord('A') + 1
    return result


def in_range(address, region):
    match = re.fullmatch(r'([A-Z]+)([1-9][0-9]*)', address)
    if not match:
        return False
    first, last = region.split(':')
    start = re.fullmatch(r'([A-Z]+)([1-9][0-9]*)', first)
    end = re.fullmatch(r'([A-Z]+)([1-9][0-9]*)', last)
    return (column_number(start[1]) <= column_number(match[1]) <= column_number(end[1])
            and int(start[2]) <= int(match[2]) <= int(end[2]))


def read_cells(content):
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        entries = archive.infolist()
        if len(entries) > 500 or sum(e.file_size for e in entries) > 20_000_000:
            raise ValueError('Archive exceeds evidence limits.')
        if len({e.filename for e in entries}) != len(entries):
            raise ValueError('Duplicate archive entry.')
        if any('externalLinks/' in e.filename or 'vbaProject' in e.filename for e in entries):
            raise ValueError('External links/macros are unsupported.')

        def xml(name):
            value = archive.read(name)
            if re.search(br'<!DOCTYPE|<!ENTITY', value, re.I):
                raise ValueError('XML declarations are unsupported.')
            return ET.fromstring(value)

        book = xml('xl/workbook.xml')
        sheets = [s for s in book.findall('m:sheets/m:sheet', NS) if s.get('name') == 'Regression Analysis']
        if len(sheets) != 1:
            raise ValueError('Expected one Regression Analysis worksheet.')
        relation_id = sheets[0].get('{' + REL + '}id')
        links = [r for r in xml('xl/_rels/workbook.xml.rels') if r.get('Id') == relation_id]
        if len(links) != 1 or links[0].get('TargetMode') == 'External':
            raise ValueError('Invalid worksheet relationship.')
        target = links[0].get('Target', '')
        name = posixpath.normpath(target.lstrip('/') if target.startswith('/') else 'xl/' + target)
        if not name.startswith('xl/worksheets/') or not name.endswith('.xml'):
            raise ValueError('Invalid worksheet path.')
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in si.iter('{' + MAIN + '}t'))
                       for si in xml('xl/sharedStrings.xml').findall('m:si', NS)]
        sheet = xml(name)
        cells = {}
        for cell in sheet.findall('m:sheetData/m:row/m:c', NS):
            address = cell.get('r', '')
            if not any(in_range(address, region) for region in SECTIONS.values()):
                continue
            if address in cells:
                raise ValueError('Duplicate cell address.')
            formula = cell.find('m:f', NS)
            value = cell.find('m:v', NS)
            raw = None if value is None else value.text
            kind = cell.get('t', 'n')
            if kind == 's' and raw is not None:
                resolved = strings[int(raw)]
            elif kind == 'inlineStr':
                resolved = ''.join(t.text or '' for t in cell.iter('{' + MAIN + '}t'))
            else:
                resolved = raw
            if raw is not None or formula is not None or resolved:
                cells[address] = {'type': kind, 'storedValue': raw, 'resolvedValue': resolved,
                                  'formula': None if formula is None else formula.text,
                                  'formulaAttributes': {} if formula is None else formula.attrib,
                                  'styleIndex': cell.get('s')}
        return cells


def mean_range_diagnostic(cells):
    columns = list('BCDEFGHIJKLM')
    evidence = [{'address': f'{c}38', 'formula': cells.get(f'{c}38', {}).get('formula'),
                 'formulaAttributes': cells.get(f'{c}38', {}).get('formulaAttributes')} for c in columns]
    fixed = all(row['formula'] == f'({c}9-AVERAGE(B9:M9))^2' and not row['formulaAttributes']
                for c, row in zip(columns, evidence))
    result = {'range': 'B38:M38', 'allStoredFormulasUseFixedMeanRange': fixed, 'cells': evidence,
              'method': 'Direct stored-formula inspection and Decimal arithmetic only; not native workbook recalculation.'}
    if not fixed:
        result['status'] = 'unrecognized-formulas-require-review'
        return result

    def number(address):
        cell = cells[address]
        if cell['type'] != 'n' or cell['storedValue'] is None:
            raise ValueError('Expected numeric source/cache at ' + address)
        value = Decimal(cell['storedValue'])
        if not value.is_finite():
            raise ValueError('Non-finite source/cache.')
        return value

    with localcontext() as ctx:
        ctx.prec = 50
        ys = [number(c + '9') for c in columns]
        mean = sum(ys) / Decimal(len(ys))
        total = sum((value - mean) ** 2 for value in ys)
        residuals = sum(number(c + '37') for c in columns)
        r_squared = Decimal(1) - residuals / total
        result.update(status='fixed-mean-formulas-observed', baselineMean=str(mean),
                      sstotFromBaselineValues=str(total), cachedSstot=str(number('D41')),
                      sstotDelta=str(total - number('D41')),
                      ssresFromCachedSquaredResiduals=str(residuals),
                      rSquaredFromThoseValues=str(r_squared), cachedRSquared=str(number('G41')),
                      rSquaredDelta=str(r_squared - number('G41')))
    return result


def extract(source):
    with Path(source).open('rb') as stream:
        content = stream.read(20_000_001)
    if len(content) > 20_000_000:
        raise ValueError('Source exceeds 20 MB.')
    digest = hashlib.sha256(content).hexdigest()
    if digest != SOURCE_HASH:
        raise ValueError('Source hash differs from the recorded reference. Review its layout before extracting.')
    cells = read_cells(content)
    return {'schemaVersion': 1, 'extractor': 'nra-source-evidence-v1', 'approved': False,
            'nativeRecalculationPerformed': False,
            'source': {'file': Path(source).name, 'sha256': digest, 'bytes': len(content), 'sheet': 'Regression Analysis'},
            'sections': {key: {'range': region, 'cells': {a: c for a, c in cells.items() if in_range(a, region)}}
                         for key, region in SECTIONS.items()},
            'diagnostics': mean_range_diagnostic(cells),
            'remainingReview': ['Missing single/multi reference workbooks', 'Reviewed units, periods and driver ordering',
                                'Native recalculation and expected results', 'Numerical tolerances and policy decisions']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('output', help='New JSON file; never overwrites an existing path.')
    args = parser.parse_args()
    try:
        report = extract(args.source)
        # Exclusive private output; never opens the workbook for writing.
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(report, stream, indent=2, ensure_ascii=False)
            stream.write('\n')
    except (ValueError, KeyError, IndexError, OSError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.exit(1, f'Evidence extraction failed ({type(error).__name__}). Check source hash/layout and use a new output path.\n')
    print('Unapproved review evidence written. Original workbook unchanged; no native recalculation performed.')


if __name__ == '__main__':
    main()
