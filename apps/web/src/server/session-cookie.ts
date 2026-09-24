export const sessionMaxAge = 7 * 86400;

export function sessionCookie() {
  const secure = new URL(process.env.AUTH_URL ?? 'http://localhost:3100').protocol === 'https:';
  return {
    name: `${secure ? '__Secure-' : ''}authjs.session-token`,
    options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure },
  };
}
