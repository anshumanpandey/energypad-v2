'use server';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/server/auth';
import { email } from '@/domain/policy';
export async function login(form: FormData) {
  const parsed = email.safeParse(form.get('email'));
  if (!parsed.success) redirect('/login?error=InvalidEmail');
  const value = String(form.get('callbackUrl') ?? '/');
  const redirectTo = /^\/invite\/[a-f0-9]{64}$/.test(value) ? value : '/';
  try {
    await signIn('email', { email: parsed.data, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) redirect('/login?error=Signin');
    throw error;
  }
}
export async function logout() {
  await signOut({ redirectTo: '/login' });
}
