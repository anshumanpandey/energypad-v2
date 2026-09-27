'use server';
import { AuthError } from 'next-auth';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/server/auth';
import { email, DomainError } from '@/domain/policy';
import { db } from '@/server/db';
import { PasswordAuth } from '@/server/password-auth';
import { passwordInput } from '@/server/password';
import { safeAuthCallback } from '@/domain/auth-callback';
import { sessionCookie } from '@/server/session-cookie';
import { writesFrozen, assertWritable } from '@/server/write-freeze';

function callback(form: FormData) {
  const value = String(form.get('callbackUrl') ?? '/');
  return safeAuthCallback(value);
}

async function passwordAction(form: FormData, mode: 'login' | 'signup') {
  const redirectTo = callback(form);
  const fail = (error: string): never =>
    redirect(`/${mode}?${new URLSearchParams({ error, callbackUrl: redirectTo })}`);
  const address = email.safeParse(form.get('email'));
  const password = passwordInput.safeParse(form.get('password'));
  if (!address.success) fail('InvalidEmail');
  if (!password.success) fail(mode === 'signup' ? 'InvalidPassword' : 'Credentials');
  if (mode === 'signup' && form.get('confirmPassword') !== password.data) fail('PasswordMismatch');
  let session;
  try {
    assertWritable();
    // nginx replaces this header with the direct client IP; never trust forwarded chains.
    const ip = (await headers()).get('x-forwarded-for') ?? 'unknown';
    session = await new PasswordAuth(db)[mode]({ email: address.data, password: password.data }, ip);
  } catch (error) {
    if (error instanceof DomainError) fail(error.code);
    console.error('Password authentication failed', { operation: mode });
    fail('Unavailable');
  }
  if (!session) return fail('Unavailable');
  const cookie = sessionCookie();
  const store = await cookies();
  const previous = store.get(cookie.name)?.value;
  if (previous) await db.session.deleteMany({ where: { sessionToken: previous } });
  store.set(cookie.name, session.sessionToken, { ...cookie.options, expires: session.expires });
  redirect(redirectTo);
}

export async function login(form: FormData) {
  return passwordAction(form, 'login');
}

export async function signup(form: FormData) {
  return passwordAction(form, 'signup');
}

// Existing email-link accounts remain accessible without granting password takeover.
export async function emailLogin(form: FormData) {
  if (writesFrozen()) redirect('/login/email?error=WRITE_FREEZE');
  const parsed = email.safeParse(form.get('email'));
  if (!parsed.success) redirect('/login/email?error=InvalidEmail');
  try {
    await signIn('email', { email: parsed.data, redirectTo: callback(form) });
  } catch (error) {
    if (error instanceof AuthError) redirect('/login/email?error=Signin');
    throw error;
  }
}

export async function logout() {
  if (writesFrozen()) redirect('/login?error=WRITE_FREEZE');
  await signOut({ redirectTo: '/login' });
}
