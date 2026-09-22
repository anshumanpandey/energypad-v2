import { open } from 'node:fs/promises';
import { DomainError } from '../src/domain/policy';
export async function readMigrationJson(file: string, maximumBytes = 2_000_000): Promise<unknown> {
  const handle = await open(file, 'r');
  let content: string;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximumBytes)
      throw new DomainError('FILE_LIMIT', `Use a JSON file no larger than ${maximumBytes} bytes.`);
    const buffer = Buffer.alloc(maximumBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maximumBytes)
      throw new DomainError('FILE_LIMIT', `Use a JSON file no larger than ${maximumBytes} bytes.`);
    content = buffer.subarray(0, length).toString('utf8');
  } finally {
    await handle.close();
  }
  let input: unknown;
  try {
    input = JSON.parse(content);
  } catch {
    throw new DomainError('JSON', 'Input must be valid JSON.');
  }
  return input;
}
