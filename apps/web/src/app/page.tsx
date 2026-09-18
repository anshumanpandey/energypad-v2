import { redirect } from 'next/navigation';
import { pageActor } from '@/server/page-auth';
import { foundation } from '@/server/services';
export default async function Home() {
  const { actor } = await pageActor();
  const memberships = await foundation.listOrganisations(actor);
  redirect(memberships.length ? `/org/${memberships[0].organisation.id}/overview` : '/onboarding');
}
