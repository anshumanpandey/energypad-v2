import { WorkspaceShell } from '@/components/workspace-shell';
import { pageActor, accessible } from '@/server/page-auth';
import { foundation } from '@/server/services';
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  const { actor, user } = await pageActor();
  const data = await accessible(() => foundation.getWorkspace(actor, organisationId));
  const memberships = await foundation.listOrganisations(actor);
  return (
    <WorkspaceShell
      organisation={data.organisation}
      organisations={memberships.map((m) => m.organisation)}
      role={data.membership.role}
      email={user.email ?? 'Your account'}
    >
      {children}
    </WorkspaceShell>
  );
}
