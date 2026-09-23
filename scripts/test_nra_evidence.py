import io
import tempfile
import unittest
from pathlib import Path
import zipfile
from extract_routine_evidence import extract as extract_routine
from extract_nra_evidence import read_cells, mean_range_diagnostic, extract, in_range


def archive_with(sheet):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w') as z:
        z.writestr('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Regression Analysis" r:id="one"/></sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="one" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr('xl/worksheets/sheet1.xml', sheet)
    return stream.getvalue()


class EvidenceTest(unittest.TestCase):
    def test_keeps_raw_formula_cache_attributes_and_zero(self):
        sheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="38"><c r="C38"><f>(C9-AVERAGE(B9:M9))^2</f><v>0</v></c><c r="D38"><f t="shared" si="1"/><v>2</v></c></row></sheetData></worksheet>'
        cells = read_cells(archive_with(sheet))
        self.assertEqual(cells['C38']['formula'], '(C9-AVERAGE(B9:M9))^2')
        self.assertEqual(cells['C38']['storedValue'], '0')
        self.assertEqual(cells['D38']['formulaAttributes'], {'t': 'shared', 'si': '1'})
        self.assertFalse(mean_range_diagnostic(cells)['allStoredFormulasUseFixedMeanRange'])

    def test_detects_actual_shift_instead_of_inventing_one(self):
        cells = {f'{c}38': {'formula': f'({c}9-AVERAGE(B9:M9))^2', 'formulaAttributes': {}}
                 for c in 'BCDEFGHIJKLM'}
        for i, c in enumerate('BCDEFGHIJKLM'):
            cells[c+'9'] = {'type': 'n', 'storedValue': str(i)}
            cells[c+'37'] = {'type': 'n', 'storedValue': '0'}
        cells.update({'D41': {'type': 'n', 'storedValue': '143'}, 'G41': {'type': 'n', 'storedValue': '1'}})
        result = mean_range_diagnostic(cells)
        self.assertTrue(result['allStoredFormulasUseFixedMeanRange'])
        self.assertEqual(result['sstotFromBaselineValues'], '143.00')
        cells['C38']['formula'] = '(C9-AVERAGE(C9:N9))^2'
        result = mean_range_diagnostic(cells)
        self.assertFalse(result['allStoredFormulasUseFixedMeanRange'])
        self.assertNotIn('sstotFromBaselineValues', result)

    def test_rejects_changed_source_without_writing_it(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'reference.xlsx'
            source.write_bytes(b'changed source')
            with self.assertRaisesRegex(ValueError, 'hash differs'):
                extract(source)
            self.assertEqual(source.read_bytes(), b'changed source')

    def test_routine_profile_preserves_source_and_rejects_unknown_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'Single Routine Adjustment V2.xlsx'
            source.write_bytes(b'not the recorded source')
            with self.assertRaisesRegex(ValueError, 'Unrecognized source hash'):
                extract_routine(source)
            self.assertEqual(source.read_bytes(), b'not the recorded source')

    def test_explicit_ranges_do_not_change_nra_defaults(self):
        sheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="17"><c r="J17"><v>2</v></c></row></sheetData></worksheet>'
        content = archive_with(sheet)
        self.assertNotIn('J17', read_cells(content))
        self.assertEqual(read_cells(content, {'routine': 'A1:M67'})['J17']['storedValue'], '2')

    def test_limits_ranges_and_rejects_xml_entities(self):
        self.assertTrue(in_range('M96', 'A89:M96'))
        self.assertFalse(in_range('N96', 'A89:M96'))
        with self.assertRaisesRegex(ValueError, 'declarations'):
            read_cells(archive_with('<!DOCTYPE a [<!ENTITY x "bad">]><worksheet/>'))


if __name__ == '__main__':
    unittest.main()
