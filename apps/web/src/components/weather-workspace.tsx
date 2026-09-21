'use client';
import { useEffect, useState } from 'react';
import { weatherJobLabels } from '@/domain/weather-jobs';
import { request, useMutation } from './forms';
import { Button } from './ui/button';
import type { WeatherMonth } from '@/domain/weather';
export type WeatherData = {
  jobs: {
    id: string;
    configurationId: string;
    status: string;
    attempts: number;
    totalAttempts: number;
    availableAt: string;
    lastError: string | null;
    updatedAt: string;
    finishedAt: string | null;
  }[];
  configurations: {
    id: string;
    version: number;
    latitude: string;
    longitude: string;
    timezone: string;
    heatingBase: string;
    coolingBase: string;
    source: string;
  }[];
  results: {
    id: string;
    configurationId: string;
    year: number;
    methodology: string;
    inputHash: string;
    createdAt: string;
    monthly: WeatherMonth[];
    provenance: {
      provider: string;
      dataset: string;
      returnedLatitude: number;
      returnedLongitude: number;
      timezone: string;
      retrievedAt: string;
      attribution: string;
      licence: string;
    };
  }[];
};
export function WeatherWorkspace({
  base,
  year,
  data,
  manage,
  reload,
}: {
  base: string;
  year: number;
  data: WeatherData;
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const latest = data.configurations[0];
  const [selected, setSelected] = useState('');
  const configId = selected || latest?.id || '';
  const config = data.configurations.find((c) => c.id === configId);
  const result = data.results.find((r) => r.configurationId === configId);
  const job = data.jobs.find((j) => j.configurationId === configId);
  const active = data.jobs.some((j) => ['QUEUED', 'RUNNING', 'RETRY_WAIT'].includes(j.status));
  const [pollError, setPollError] = useState('');
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        await reload();
        if (!stopped) setPollError('');
      } catch {
        if (!stopped)
          setPollError(
            'Could not refresh weather progress. Your job remains saved; use Refresh weather status to reconnect.',
          );
      }
      if (!stopped) timer = setTimeout(poll, 5000);
    }
    timer = setTimeout(poll, 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, reload]);
  return (
    <section className="panel stack-form" aria-label="Historical weather">
      <h2>Historical weather · {year}</h2>
      <p>
        Open-Meteo ERA5 provides modeled historical weather. Monthly degree days are calculated from daily mean
        temperatures using your explicit heating and cooling bases. Missing days prevent enrichment; they are never
        replaced with zero.
      </p>
      {m.feedback}
      {manage && (
        <details open={!latest}>
          <summary>{latest ? 'Add a weather settings version' : 'Configure site weather'}</summary>
          <form
            key={latest?.id ?? 'new'}
            className="stack-form"
            aria-label="Weather settings"
            onSubmit={(e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              void m.run(async () => {
                const saved = await request(`${base}/configuration`, 'POST', values);
                setSelected(saved.id);
                await reload();
              }, 'Weather settings saved. Fetch weather for the selected year when ready.');
            }}
          >
            <fieldset className="form-grid" disabled={m.disabled}>
              <label>
                Weather latitude
                <input
                  name="latitude"
                  type="number"
                  min="-90"
                  max="90"
                  step="0.000001"
                  defaultValue={latest?.latitude}
                  required
                />
              </label>
              <label>
                Weather longitude
                <input
                  name="longitude"
                  type="number"
                  min="-180"
                  max="180"
                  step="0.000001"
                  defaultValue={latest?.longitude}
                  required
                />
              </label>
              <label>
                Weather timezone
                <input
                  name="timezone"
                  placeholder="Europe/London"
                  defaultValue={latest?.timezone}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Heating base (°C)
                <input
                  name="heatingBase"
                  type="number"
                  min="-50"
                  max="50"
                  step="0.001"
                  defaultValue={latest?.heatingBase}
                  required
                />
              </label>
              <label>
                Cooling base (°C)
                <input
                  name="coolingBase"
                  type="number"
                  min="-50"
                  max="50"
                  step="0.001"
                  defaultValue={latest?.coolingBase}
                  required
                />
              </label>
              <label>
                Weather settings source
                <input
                  name="source"
                  minLength={3}
                  maxLength={500}
                  placeholder="Coordinate reference and degree-day base policy"
                  required
                />
              </label>
            </fieldset>
            <p>
              Saving a new version preserves previous settings and results. Use the site’s local IANA timezone to define
              calendar days. No location is inferred from its address.
            </p>
            <Button disabled={m.disabled}>Save weather settings</Button>
          </form>
        </details>
      )}
      {!latest && (
        <p>
          Weather is not configured for this site. An Owner or Admin can enter its coordinates and degree-day bases.
        </p>
      )}
      {latest && (
        <>
          <label>
            Weather settings version
            <select value={configId} disabled={m.disabled} onChange={(e) => setSelected(e.target.value)}>
              {data.configurations.map((c) => (
                <option key={c.id} value={c.id}>
                  Version {c.version} · {c.latitude}, {c.longitude} · {c.timezone}
                </option>
              ))}
            </select>
          </label>
          {config && (
            <div className="site-history-entry">
              <strong>
                Heating base {config.heatingBase} °C · Cooling base {config.coolingBase} °C
              </strong>
              <p>Source: {config.source}</p>
            </div>
          )}
          <strong>{result ? '12/12 months enriched' : '0/12 months enriched for this settings version'}</strong>
          {job && (
            <div className="site-history-entry" aria-label="Weather job progress">
              <strong>
                {weatherJobLabels[job.status] ?? job.status} · Attempt {job.attempts}/3
              </strong>
              {job.status === 'QUEUED' && (
                <p>Waiting for a weather worker. This job is saved; you can leave this page and return later.</p>
              )}
              {job.status === 'RUNNING' && (
                <p>Fetching and validating daily weather. Interrupted work is recovered automatically.</p>
              )}
              {job.status === 'RETRY_WAIT' && (
                <p>Next automatic attempt: {new Date(job.availableAt).toLocaleString()}.</p>
              )}
              {job.lastError && <p role={job.status === 'FAILED' ? 'alert' : undefined}>{job.lastError}</p>}
              {job.status === 'FAILED' && manage && (
                <Button
                  disabled={m.disabled}
                  onClick={() =>
                    void m.run(async () => {
                      await request(`${base}/jobs/${job.id}/retry`, 'POST');
                      await reload();
                    }, 'Weather retry queued.')
                  }
                >
                  Retry weather job
                </Button>
              )}
            </div>
          )}
          {pollError && <p role="alert">{pollError}</p>}
          {job && (
            <Button
              variant="secondary"
              disabled={m.disabled}
              onClick={() =>
                void m.run(async () => {
                  await reload();
                  setPollError('');
                }, 'Weather status refreshed.')
              }
            >
              Refresh weather status
            </Button>
          )}
          {manage && !result && !job && (
            <>
              <p>
                Fetch sends the selected coordinates, timezone and date range to Open-Meteo. Choose a completed year
                from 1940 onwards, allowing seven days after year end for publication.
              </p>
              <Button
                disabled={m.disabled || !configId}
                onClick={() =>
                  void m.run(async () => {
                    await request(`${base}/enrich`, 'POST', { configurationId: configId, year });
                    await reload();
                  }, 'Weather enrichment queued. Progress will update automatically.')
                }
              >
                {m.pending ? 'Working…' : `Fetch weather for ${year}`}
              </Button>
            </>
          )}
          {result && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="import-preview-table">
                  <caption>Monthly weather, settings version {config?.version}</caption>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Days</th>
                      <th>Mean temperature (°C)</th>
                      <th>HDD (°C·days)</th>
                      <th>CDD (°C·days)</th>
                      <th>Daylight (hours)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.monthly.map((month) => (
                      <tr key={month.month}>
                        <td>{month.month}</td>
                        <td>{month.days}</td>
                        <td>{month.meanTemperature}</td>
                        <td>{month.heatingDegreeDays}</td>
                        <td>{month.coolingDegreeDays}</td>
                        <td>{month.daylightHours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>Weather provenance and method</summary>
                <p>
                  {result.provenance.provider} / {result.provenance.dataset} · retrieved{' '}
                  {new Date(result.provenance.retrievedAt).toLocaleString()}
                </p>
                <p>
                  Returned grid coordinates: {result.provenance.returnedLatitude}, {result.provenance.returnedLongitude}
                  . Timezone: {result.provenance.timezone}.
                </p>
                <p>
                  Method: {result.methodology}. Daily HDD = max(0, heating base − daily mean temperature); daily CDD =
                  max(0, daily mean temperature − cooling base). Degree days and daylight hours are summed by calendar
                  month. Mean temperature is the average of daily means. Monthly values are rounded to three decimals;
                  source daily values are retained.
                </p>
                <p style={{ overflowWrap: 'anywhere' }}>Input fingerprint: {result.inputHash}</p>
              </details>
            </>
          )}
        </>
      )}
      <p className="field-hint">
        Weather data by <a href="https://open-meteo.com/">Open-Meteo</a> /{' '}
        <a href="https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels">Copernicus ERA5</a>, under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Monthly aggregates and degree days
        calculated by EnergiePad.
      </p>
    </section>
  );
}
