'use client';
import {
  defaultFieldMapping,
  mappingFields,
  mappingFieldNullable,
  type ApiFieldMapping,
} from '@/domain/api-field-mapping';
import { type ApiDataset } from '@/domain/api-import';
import { Button } from './ui/button';
export function ApiMappingForm({
  dataset,
  mapping,
  disabled,
  onChange,
}: {
  dataset: ApiDataset;
  mapping: ApiFieldMapping;
  disabled: boolean;
  onChange: (mapping: ApiFieldMapping) => void;
}) {
  return (
    <fieldset className="api-mapping" disabled={disabled}>
      <legend>Field mapping</legend>
      <label className="api-mapping-toggle">
        <input
          type="checkbox"
          checked={mapping.enabled}
          onChange={(event) => onChange({ ...mapping, enabled: event.target.checked })}
        />
        Use custom response fields
      </label>
      <p>Match fields returned by your API to EnergiePad fields. Mapping changes take effect on the next fetch.</p>
      {mapping.enabled && (
        <>
          <label>
            Records path
            <input
              value={mapping.recordsPath}
              onChange={(event) => onChange({ ...mapping, recordsPath: event.target.value })}
              placeholder="data.readings"
            />
          </label>
          <p>
            Use a dot-separated path to the records array, such as data.readings. Leave blank when the response itself
            is an array. Field paths below are relative to each record.
          </p>
          <div className="import-records-scroll">
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Our field</th>
                  <th>Your API field</th>
                </tr>
              </thead>
              <tbody>
                {mappingFields(dataset).map((field) => (
                  <tr key={field}>
                    <th scope="row">
                      {field}
                      <small>
                        {mappingFieldNullable(dataset, field) ? 'Optional · blank becomes unknown' : 'Required'}
                      </small>
                    </th>
                    <td>
                      <input
                        aria-label={`Source field for ${field}`}
                        value={mapping.fields[field] ?? field}
                        required={!mappingFieldNullable(dataset, field)}
                        placeholder={`e.g. ${field === 'site' ? 'building.name' : field}`}
                        onChange={(event) =>
                          onChange({ ...mapping, fields: { ...mapping.fields, [field]: event.target.value } })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Numeric fields accept numbers or plain decimal strings. Units and driver classifications use the values
            shown in the JSON example.
          </p>
          <Button type="button" variant="ghost" onClick={() => onChange(defaultFieldMapping(dataset))}>
            Reset field mapping
          </Button>
        </>
      )}
    </fieldset>
  );
}
