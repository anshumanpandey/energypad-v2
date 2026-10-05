'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { request } from './forms';
import { Button } from './ui/button';
import type { WeatherData } from './weather-workspace';

export function WasteWeather({
  orgId,
  siteId,
  year,
  manage,
}: {
  orgId: string;
  siteId: string;
  year: number;
  manage: boolean;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('Preparing site weather from the API…');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!manage) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const base = `organisations/${orgId}/sites/${siteId}/energy/weather`;
    async function start() {
      setError('');
      setStatus('Resolving site location and fetching baseline/reporting weather…');
      try {
        const prepared: {
          configurationId: string;
          heatingBase: string;
          coolingBase: string;
          jobs: { id: string; year: number; status: string }[];
        } = await request(`${base}/prepare-calculation`, 'POST', { year });
        if (!active) return;
        setStatus(
          `Fetching ${year - 1} and ${year} weather. Heating base ${prepared.heatingBase} °C; cooling base ${prepared.coolingBase} °C. Settings are editable in HDD & CDD.`,
        );
        async function poll() {
          try {
            const years: WeatherData[] = await Promise.all(
              prepared.jobs.map((job) => request(`${base}?year=${job.year}`, 'GET')),
            );
            if (!active) return;
            const jobs = prepared.jobs.map((job, index) => years[index].jobs.find((record) => record.id === job.id));
            const failed = jobs.find((job) => job?.status === 'FAILED');
            if (failed) throw new Error(failed.lastError || 'Weather fetching failed.');
            if (jobs.every((job) => job?.status === 'SUCCEEDED')) {
              setStatus('Weather fetched. Recalculating Waste & Savings…');
              router.refresh();
              return;
            }
            timer = setTimeout(poll, 5000);
          } catch (failure) {
            if (active) setError(failure instanceof Error ? failure.message : 'Weather status could not be loaded.');
          }
        }
        await poll();
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'Weather fetching could not start.');
      }
    }
    void start();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [orgId, siteId, year, manage, attempt, router]);
  return (
    <section className="panel stack-form" aria-label="Calculation weather">
      <h2>Weather inputs from API</h2>
      <p role={error ? 'alert' : 'status'}>
        {manage ? error || status : 'An owner or administrator needs to fetch weather for this site.'}
      </p>
      <p>
        Weather uses the uploaded site city. Only complete published months are fetched; future months remain
        unavailable.
      </p>
      <Link href={`/org/${orgId}/degree-days?site=${siteId}&year=${year}`}>View or edit HDD &amp; CDD settings</Link>
      {error && manage && <Button onClick={() => setAttempt((value) => value + 1)}>Retry weather fetch</Button>}
    </section>
  );
}
