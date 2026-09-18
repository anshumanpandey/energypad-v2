import { api, readBody } from '@/server/http';
import { foundation } from '@/server/services';
import { DomainError } from '@/domain/policy';

type Context = { params: Promise<{ segments: string[] }> };
async function handle(request: Request, context: Context) {
  return api(request, async (actor) => {
    const { segments: s } = await context.params;
    const method = request.method;
    if (s.join('/') === 'organisations') {
      if (method === 'GET') return foundation.listOrganisations(actor);
      if (method === 'POST') return foundation.createOrganisation(actor, await readBody(request));
    }
    if (s.join('/') === 'invitations/accept' && method === 'POST')
      return foundation.acceptInvitation(actor, await readBody(request));
    if (s[0] === 'organisations' && s[1]) {
      const org = s[1];
      if (s.length === 2) {
        if (method === 'GET') return foundation.getWorkspace(actor, org);
        if (method === 'PATCH') return foundation.updateOrganisation(actor, org, await readBody(request));
      }
      if (s.length === 3) {
        if (s[2] === 'members' && method === 'GET') return foundation.listMembers(actor, org);
        if (s[2] === 'invitations') {
          if (method === 'GET') return foundation.listInvitations(actor, org);
          if (method === 'POST') return foundation.invite(actor, org, await readBody(request));
        }
        if (s[2] === 'sites' && method === 'GET') return foundation.listSites(actor, org);
        if (s[2] === 'audit' && method === 'GET') return foundation.listAudit(actor, org);
      }
      if (s.length === 4) {
        if (s[2] === 'members') {
          if (method === 'PATCH') return foundation.changeMember(actor, org, s[3], await readBody(request));
          if (method === 'DELETE') return foundation.changeMember(actor, org, s[3], undefined, true);
        }
        if (s[2] === 'invitations' && method === 'DELETE') return foundation.revokeInvitation(actor, org, s[3]);
        if (s[2] === 'sites' && method === 'GET') return foundation.getSite(actor, org, s[3]);
      }
      if (s.length === 5 && s[2] === 'members' && s[4] === 'sites' && method === 'PUT')
        return foundation.assignSites(actor, org, s[3], await readBody(request));
    }
    throw new DomainError('NOT_FOUND', 'This endpoint is not available.', 404);
  });
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
