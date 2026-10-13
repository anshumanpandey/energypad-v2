'use client';
import { useEffect, useRef, useState } from 'react';
import { apiImportExample, apiImportPayload, apiImportSettings } from '@/domain/api-import';
import { Button } from './ui/button';
import { request, responseError, useMutation } from './forms';

export function ApiImportSource({
  orgId,
  disabled,
  onLoaded,
}: {
  orgId: string;
  disabled: boolean;
  onLoaded: (file: File) => void;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showExample, setShowExample] = useState(false);
  const m = useMutation();
  const path = `organisations/${orgId}/api-import`;
  useEffect(() => {
    let active = true;
    void request(path, 'GET')
      .then((data) => {
        if (active) setUrl(data.url);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load the saved API URL.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path]);
  async function save() {
    const parsed = apiImportSettings.safeParse({ url });
    if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join(' '));
    const settings = parsed.data;
    await request(path, 'PUT', settings);
    setUrl(settings.url);
    return settings.url;
  }
  async function pull() {
    if (!url.trim()) throw new Error('Enter an API URL first.');
    const savedUrl = await save();
    const response = await fetch(savedUrl, {
      credentials: 'omit',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    }).catch(() => {
      throw new Error(
        'Could not fetch API data. Check that the endpoint is reachable, permits this app through CORS, and responds within 30 seconds without redirecting.',
      );
    });
    if (!response.ok) throw new Error(`API request failed (${response.status}).`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The API returned an empty response.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2_000_000) {
          await reader.cancel();
          throw new Error('API responses must be smaller than 2 MB.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let data: unknown;
    try {
      data = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error('The API must return valid JSON. See the JSON example.');
    }
    const parsed = apiImportPayload.safeParse(data);
    if (!parsed.success)
      throw new Error(
        parsed.error.issues.map((issue) => `${issue.path.join('.') || 'Response'}: ${issue.message}`).join('\n'),
      );
    const converted = await fetch(`/api/v1/${path}/workbook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    if (!converted.ok) throw responseError(await converted.json());
    const blob = await converted.blob();
    if (blob.size > 2_000_000)
      throw new Error('The converted data exceeds the 2 MB import limit. Request fewer records.');
    onLoaded(new File([blob], 'api-data.xlsx'));
  }
  return (
    <section className="api-import-source" aria-label="API data source">
      <h3>Pull data from API</h3>
      <p>
        Save an HTTPS endpoint returning JSON. The provider must allow this app through CORS. Requests use GET without
        credentials; redirects are not followed.
      </p>
      {loadError && <p role="alert">{loadError} Refresh to try again.</p>}
      <form
        className="stack-form"
        onSubmit={(event) => {
          event.preventDefault();
          void m.run(async () => {
            await save();
          }, 'API URL saved.');
        }}
      >
        <label>
          API URL
          <input
            type="url"
            value={url}
            disabled={disabled || m.disabled || loading || !!loadError}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://provider.example/energy-data"
          />
        </label>
        <div className="api-import-actions">
          <Button disabled={disabled || m.disabled || loading || !!loadError}>
            {loading ? 'Loading API URL…' : 'Save API URL'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || m.disabled || loading || !!loadError || !url.trim()}
            onClick={() => {
              void m.run(pull, 'API data fetched. Validate and review the records below before importing.');
            }}
          >
            {m.pending ? 'Please wait…' : 'Save & fetch data'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShowExample(true)}>
            View JSON example
          </Button>
        </div>
        {m.feedback}
      </form>
      {showExample && <JsonExample onClose={() => setShowExample(false)} />}
    </section>
  );
}
function JsonExample({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="site-entry-dialog api-import-example"
      aria-labelledby="api-json-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="api-import-actions">
        <h2 id="api-json-title">Expected API JSON response</h2>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
      <p>
        Return version 1 and all four arrays, each with at least one record. Use exactly these field names. Numbers must
        be JSON numbers, not formatted strings. Use an existing site name or code in this workspace.
      </p>
      <ul>
        <li>Months: 1–12; years: 1900–2199. Include every month you intend to import.</li>
        <li>
          Consumption: utility and unit follow the workbook template. Total cost includes VAT; operating hours are per
          day (0–24). Use null for unknown costs, population or hours. Conversion factor converts the fuel unit to kWh
          (1 for kWh).
        </li>
        <li>Emissions: site-wide kgCO2e per kWh. Targets: site-wide energy in kWh and carbon in kgCO2e.</li>
        <li>Drivers: one record per site/year; R = routine, NR = non-routine, N/A = not applicable.</li>
        <li>
          Existing records follow the same update rules as workbook imports. Validation reports invalid fields and cells
          before import.
        </li>
      </ul>
      <pre>
        <code>{JSON.stringify(apiImportExample, null, 2)}</code>
      </pre>
    </dialog>
  );
}
