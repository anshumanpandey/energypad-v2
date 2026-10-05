'use client';
import { useEffect, useState } from 'react';
import { request, useMutation } from './forms';
import { Button } from './ui/button';
import { WeatherWorkspace, type WeatherData } from './weather-workspace';

export function DegreeDaysWorkspace({
  orgId,
  sites,
  manage,
  initialSite,
  initialYear,
}: {
  orgId: string;
  sites: { id: string; name: string }[];
  manage: boolean;
  initialSite?: string;
  initialYear?: number;
}) {
  const [site, setSite] = useState(initialSite ?? sites[0]?.id ?? '');
  const mutation = useMutation();
  const [year, setYear] = useState(initialYear ?? new Date().getUTCFullYear() - 1);
  const [loaded, setLoaded] = useState<{ key: string; data: WeatherData } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const base = `organisations/${orgId}/sites/${site}/energy/weather`;
  const key = `${base}:${year}`;
  useEffect(() => {
    if (!site) return;
    let active = true;
    request(`${base}?year=${year}`, 'GET')
      .then((data: WeatherData) => {
        if (active) {
          setLoaded({ key, data });
          setError(null);
        }
      })
      .catch((failure: unknown) => {
        if (active)
          setError({ key, message: failure instanceof Error ? failure.message : 'Weather data could not be loaded.' });
      });
    return () => {
      active = false;
    };
  }, [base, key, site, year]);
  return (
    <div className="stack-form">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WEATHER DRIVERS</span>
          <h1>HDD &amp; CDD</h1>
          <p>
            Review monthly heating and cooling degree days and the weather configuration used for site calculations.
          </p>
        </div>
      </div>
      {!sites.length ? (
        <p>Add a site to view degree days.</p>
      ) : (
        <>
          <div className="panel form-grid">
            <label>
              Site
              <select
                disabled={mutation.disabled}
                aria-label="Degree days site"
                value={site}
                onChange={(event) => setSite(event.target.value)}
              >
                {sites.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Year
              <input
                aria-label="Degree days year"
                disabled={mutation.disabled}
                type="number"
                min={1900}
                max={2199}
                value={year}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isInteger(value) && value >= 1900 && value <= 2199) setYear(value);
                }}
              />
            </label>
          </div>
          {manage && (
            <div className="panel stack-form">
              <Button
                disabled={mutation.disabled}
                onClick={() =>
                  void mutation.run(async () => {
                    await request(`${base}/prepare-calculation`, 'POST', { year });
                    const data: WeatherData = await request(`${base}?year=${year}`, 'GET');
                    setLoaded({ key, data });
                  }, 'Site location resolved. Weather fetching queued; progress updates automatically.')
                }
              >
                Fetch weather from site location
              </Button>
              {mutation.feedback}
              <p>
                Uses the uploaded site city and existing weather settings. New sites use editable bases of 15.5 °C for
                heating and 18 °C for cooling.
              </p>
            </div>
          )}
          {error?.key === key ? (
            <p role="alert">{error.message}</p>
          ) : loaded?.key === key ? (
            <WeatherWorkspace
              key={key}
              base={base}
              year={year}
              data={loaded.data}
              manage={manage}
              reload={async () => {
                const data: WeatherData = await request(`${base}?year=${year}`, 'GET');
                setLoaded({ key, data });
              }}
            />
          ) : (
            <p role="status">Loading degree days…</p>
          )}
        </>
      )}
    </div>
  );
}
