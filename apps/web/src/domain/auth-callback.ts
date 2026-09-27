// Only known internal destinations are accepted, never arbitrary URLs or encoded paths.
const uuidPart = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const retainedReport = new RegExp(`^/retained-reports/${uuidPart}/${uuidPart}/${uuidPart}$`, 'i');
export function safeAuthCallback(value: unknown): string {
  if (typeof value !== 'string' || value.trim() !== value) return '/';
  return /^\/invite\/[a-f0-9]{64}$/.test(value) || retainedReport.test(value) ? value : '/';
}
