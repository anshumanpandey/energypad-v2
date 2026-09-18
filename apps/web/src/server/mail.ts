import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Mailer } from './foundation';

export const mailer: Mailer = {
  async send(message) {
    if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
      // Local-only capture. Never expose this folder through an application route.
      const directory = path.join(process.cwd(), '.local', 'mail');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(
        path.join(directory, `${Date.now()}-${randomUUID()}.json`),
        JSON.stringify({ ...message, createdAt: new Date().toISOString() }),
        { mode: 0o600 },
      );
      return;
    }
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Mail delivery is not configured.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Mail delivery failed.');
  },
};
