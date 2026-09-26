'use client';
import { useRef, useState } from 'react';
import { request } from './forms';
import { Button } from './ui/button';
type Entry = { id: string; family: string; createdAt: string; fingerprint: string };
export function ReportArchives({
  path,
  source,
  canCapture,
}: {
  path: string;
  source: { url: string; fingerprint: string } | null;
  canCapture: boolean;
}) {
  const [items, setItems] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const keys = useRef(new Map<string, string>());
  async function load(older = false) {
    setPending(true);
    setError('');
    try {
      const page = await request(`${path}${older && cursor ? `?cursor=${cursor}` : ''}`, 'GET');
      setItems((previous) =>
        older
          ? [...new Map<string, Entry>([...previous, ...page.items].map((r: Entry) => [r.id, r])).values()]
          : page.items,
      );
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load retained reports.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel stack-form" aria-label="Retained reports">
      <h2>Retained report snapshots</h2>
      <p>
        Retain an exact preview for later download. Historical values and validation labels stay unchanged. No
        scheduling or email delivery is enabled.
      </p>
      {canCapture && (
        <Button
          type="button"
          disabled={pending || !source}
          onClick={async () => {
            if (!source) return;
            setPending(true);
            setError('');
            setMessage('');
            try {
              const identity = `${source.url}:${source.fingerprint}`;
              if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
              const definition = Object.fromEntries(new URL(source.url, window.location.origin).searchParams);
              const saved = await request(path, 'POST', {
                definition,
                fingerprint: source.fingerprint,
                requestKey: keys.current.get(identity),
              });
              setMessage(`Report retained: ${saved.id}`);
              const page = await request(path, 'GET');
              setItems(page.items);
              setCursor(page.nextCursor);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to retain report.');
            } finally {
              setPending(false);
            }
          }}
        >
          Retain current preview
        </Button>
      )}
      <Button type="button" disabled={pending} onClick={() => void load()}>
        Refresh retained reports
      </Button>
      {cursor && (
        <Button type="button" disabled={pending} onClick={() => void load(true)}>
          Load older retained reports
        </Button>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {items.map((item) => (
        <article key={item.id} className="stack-form">
          <strong>
            {item.family} · {new Date(item.createdAt).toLocaleString()}
          </strong>
          <span>{item.id}</span>
          <a href={`/api/v1/${path}/${item.id}?format=json`}>Download retained JSON</a>
          <a href={`/api/v1/${path}/${item.id}?format=csv`}>Download retained CSV</a>
        </article>
      ))}
    </section>
  );
}
