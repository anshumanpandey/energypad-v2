'use client';
import { useEffect, useState } from 'react';
import { request } from './forms';
import { Button } from './ui/button';
import { formatEnergyValue } from './format-energy-value';
import { utilityLabel } from '@/domain/consumption-sort';

type Reading = {
  id: string;
  siteId: string;
  periodStart: string;
  fuel: string;
  endUse: string;
  sourceQuantity: string;
  sourceUnit: string;
  normalizedKwh: string;
  netCost: string | null;
  grossCost: string | null;
  currency: string | null;
  site: { name: string };
  qualityFlags: string[];
  meter: { name: string };
};

export function AllConsumption({ orgId, sites }: { orgId: string; sites: { id: string; name: string }[] }) {
  const [records, setRecords] = useState<Reading[]>([]);
  const [site, setSite] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    request(`organisations/${orgId}/consumption-records`, 'GET')
      .then((data: Reading[]) => {
        if (active) {
          setRecords(data);
          setError('');
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Unable to load consumption.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgId, refresh]);
  const years = [...new Set(records.map((record) => record.periodStart.slice(0, 4)))].sort().reverse();
  const visible = records.filter(
    (record) => (!site || record.siteId === site) && (!year || record.periodStart.startsWith(year)),
  );
  return (
    <section className="panel stack-form" aria-label="Consumption for all sites and years">
      <h2>Consumption · all sites and years</h2>
      <div className="form-grid">
        <label>
          Site
          <select aria-label="Consumption site" value={site} onChange={(event) => setSite(event.target.value)}>
            <option value="">All sites</option>
            {sites.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <select aria-label="Consumption year" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">All years</option>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button
        disabled={loading}
        onClick={() => {
          setLoading(true);
          setRefresh((value) => value + 1);
        }}
      >
        Refresh consumption
      </Button>
      {error ? (
        <p role="alert">{error}</p>
      ) : loading ? (
        <p role="status">Loading consumption…</p>
      ) : (
        <>
          <p>{visible.length} readings · current revisions</p>
          {!visible.length ? (
            <p>No consumption readings for this selection. Import your workbook to populate this view.</p>
          ) : (
            <div className="energy-records-scroll" role="region" aria-label="All consumption table" tabIndex={0}>
              <table className="energy-records-table">
                <thead>
                  <tr>
                    {[
                      'Site',
                      'Month',
                      'Meter',
                      'Utility',
                      'Energy use',
                      'Consumption',
                      'Energy (kWh)',
                      'Net cost',
                      'Gross cost',
                      'Missing data',
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((record) => (
                    <tr key={record.id}>
                      <td>{record.site.name}</td>
                      <td>{record.periodStart.slice(0, 7)}</td>
                      <td>{record.meter.name}</td>
                      <td>{utilityLabel(record.fuel)}</td>
                      <td>{record.endUse}</td>
                      <td>
                        {formatEnergyValue(record.sourceQuantity)} {record.sourceUnit}
                      </td>
                      <td>{formatEnergyValue(record.normalizedKwh)}</td>
                      <td>
                        {formatEnergyValue(record.netCost)} {record.currency}
                      </td>
                      <td>
                        {formatEnergyValue(record.grossCost)} {record.currency}
                      </td>
                      <td>
                        {Array.isArray(record.qualityFlags) &&
                        record.qualityFlags.includes('Missing month filled with 0 after confirmation')
                          ? 'Missing month filled with 0 after confirmation'
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
