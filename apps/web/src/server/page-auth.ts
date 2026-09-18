import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { auth } from './auth';
import { actorFor } from './foundation';
import { DomainError } from '../domain/policy';
import { ZodError } from 'zod';

export async function pageActor(returnTo = '/') {
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
  return { actor: actorFor(session.user.id), user: session.user };
}
export async function accessible<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ZodError || (error instanceof DomainError && [403, 404].includes(error.status))) notFound();
    if (error instanceof DomainError && error.status === 401) redirect('/login');
    throw error;
  }
}
