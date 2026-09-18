'use server';

import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { DomainError } from '@/domain/policy';
import { pageActor } from '@/server/page-auth';
import { foundation } from '@/server/services';

export type OnboardingState = {
  error: string;
  values: { name: string; currency: string; timezone: string };
};

export async function createWorkspace(_previous: OnboardingState, form: FormData): Promise<OnboardingState> {
  const { actor } = await pageActor('/onboarding');
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };
  const values = { name: field('name'), currency: field('currency'), timezone: field('timezone') };
  let organisation;
  try {
    organisation = await foundation.createOrganisation(actor, values);
  } catch (error) {
    if (error instanceof DomainError && error.status === 401) redirect('/login');
    if (error instanceof ZodError) return { values, error: error.issues[0]?.message ?? 'Check your input.' };
    if (error instanceof DomainError) return { values, error: error.message };
    console.error('Workspace creation failed', { correlationId: actor.correlationId });
    return { values, error: 'We couldn’t create your workspace. Please try again.' };
  }
  // A server redirect avoids racing router.push with router.refresh after creation.
  redirect(`/org/${organisation.id}/overview`);
}
