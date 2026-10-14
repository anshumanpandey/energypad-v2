'use client';
import { useEffect, useRef, useState } from 'react';
import { Zap, Leaf, Target, SlidersHorizontal, Cable } from 'lucide-react';
import {
  apiImportExample,
  datasetPayload,
  apiImportSettings,
  apiDatasets,
  apiDatasetLabels,
  type ApiDataset,
} from '@/domain/api-import';
import { ImportReview } from './import-review';
import { Button } from './ui/button';
import { request, responseError, useMutation } from './forms';

const datasetIcons = { consumption: Zap, emissions: Leaf, targets: Target, drivers: SlidersHorizontal };

export function ApiImportSource(props: { orgId: string; disabled: boolean }) {
  const [dataset, setDataset] = useState<ApiDataset>('consumption');
  const [busy, setBusy] = useState(false);
  return (
    <section className="api-connections" aria-label="API Connections">
      <div className="api-connections-heading">
        <span className="api-connections-icon">
          <Cable size={22} aria-hidden="true" />
        </span>
        <div>
          <h2>API connections</h2>
          <p>Manage a separate endpoint for each dataset.</p>
        </div>
      </div>
      <div className="api-dataset-tabs" role="tablist" aria-label="API datasets">
        {apiDatasets.map((key, index) => {
          const Icon = datasetIcons[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`api-tab-${key}`}
              aria-controls={`api-panel-${key}`}
              aria-selected={dataset === key}
              tabIndex={dataset === key ? 0 : -1}
              disabled={props.disabled || busy}
              onClick={() => setDataset(key)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % 4
                    : event.key === 'ArrowLeft'
                      ? (index + 3) % 4
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? 3
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setDataset(apiDatasets[next]);
                  document.getElementById(`api-tab-${apiDatasets[next]}`)?.focus();
                }
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{apiDatasetLabels[key]}</span>
            </button>
          );
        })}
      </div>
      {apiDatasets.map((key) => (
        <div
          key={key}
          role="tabpanel"
          id={`api-panel-${key}`}
          aria-labelledby={`api-tab-${key}`}
          hidden={dataset !== key}
        >
          <DatasetSource {...props} disabled={props.disabled || busy} dataset={key} onBusy={setBusy} />
        </div>
      ))}
    </section>
  );
}

function DatasetSource({
  dataset,
  onBusy,
  orgId,
  disabled,
}: {
  dataset: ApiDataset;
  onBusy: (busy: boolean) => void;
  orgId: string;
  disabled: boolean;
}) {
  const [loaded, setLoaded] = useState<{ file: File; revision: number } | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showExample, setShowExample] = useState(false);
  const m = useMutation();
  useEffect(() => {
    if (m.pending || reviewBusy) {
      onBusy(true);
      return () => onBusy(false);
    }
  }, [m.pending, reviewBusy, onBusy]);
  const path = `organisations/${orgId}/api-import`;
  useEffect(() => {
    let active = true;
    void request(`${path}?dataset=${dataset}`, 'GET')
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
  }, [path, dataset]);
  async function save() {
    const parsed = apiImportSettings.safeParse({ url });
    if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join(' '));
    const settings = parsed.data;
    await request(`${path}?dataset=${dataset}`, 'PUT', settings);
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
        'Could not fetch API data. Check that the endpoint is reachable, permits this app through CORS, and responds within 30 seconds without redirecting. Browsers may block HTTP endpoints when this app is opened over HTTPS.',
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
    const parsed = datasetPayload(dataset).safeParse(data);
    if (!parsed.success)
      throw new Error(
        parsed.error.issues.map((issue) => `${issue.path.join('.') || 'Response'}: ${issue.message}`).join('\n'),
      );
    const converted = await fetch(`/api/v1/${path}/workbook?dataset=${dataset}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    if (!converted.ok) throw responseError(await converted.json());
    const blob = await converted.blob();
    if (blob.size > 2_000_000)
      throw new Error('The converted data exceeds the 2 MB import limit. Request fewer records.');
    setLoaded((current) => ({ file: new File([blob], `api-${dataset}.xlsx`), revision: (current?.revision ?? 0) + 1 }));
  }
  return (
    <section className="api-import-source" aria-label="API data source">
      <h3>{apiDatasetLabels[dataset]} API</h3>
      <p>
        Save an HTTP or HTTPS endpoint returning JSON. The provider must allow this app through CORS. Requests use GET
        without credentials; redirects are not followed. When this app is opened over HTTPS, your browser may block HTTP
        endpoints.
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
      {loaded && (
        <ImportReview
          key={loaded.revision}
          orgId={orgId}
          dataset={dataset}
          initialFile={loaded.file}
          onBusy={setReviewBusy}
        />
      )}
      {showExample && <JsonExample dataset={dataset} onClose={() => setShowExample(false)} />}
    </section>
  );
}
function JsonExample({ onClose, dataset }: { onClose: () => void; dataset: ApiDataset }) {
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
        Return version 1 and a {dataset} array with at least one record. Use exactly these field names. Numbers must be
        JSON numbers, not formatted strings. Use an existing site name or code in this workspace.
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
        <code>{JSON.stringify({ version: 1, [dataset]: apiImportExample[dataset] }, null, 2)}</code>
      </pre>
    </dialog>
  );
}
