import { api, readBody, readBytes } from '@/server/http';
import { foundation, siteService } from '@/server/services';
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
      if (s[2] === 'portfolios') {
        if (s.length === 3 && method === 'GET') return siteService.portfolios(actor, org);
        if (s.length === 3 && method === 'POST') return siteService.savePortfolio(actor, org, await readBody(request));
        if (s.length === 4 && method === 'PATCH')
          return siteService.savePortfolio(actor, org, await readBody(request), s[3]);
        if (s.length === 4 && method === 'DELETE') return siteService.archivePortfolio(actor, org, s[3]);
      }
      if (s[2] === 'imports') {
        if (s.length === 3 && method === 'GET') return siteService.imports(actor, org);
        if (s.length === 3 && method === 'POST')
          return siteService.upload(actor, org, await readBytes(request, 2_000_000));
        if (s.length === 4 && method === 'GET') return siteService.importDetail(actor, org, s[3]);
        if (s.length === 5 && s[4] === 'preview' && method === 'POST')
          return siteService.mapImport(actor, org, s[3], await readBody(request));
        if (s.length === 5 && s[4] === 'commit' && method === 'POST') return siteService.commitImport(actor, org, s[3]);
      }
      if (s[2] === 'sites') {
        if (s.length === 3 && method === 'POST') return siteService.createSite(actor, org, await readBody(request));
        if (s.length === 4 && method === 'GET') return siteService.siteDetail(actor, org, s[3]);
        if (s.length === 4 && method === 'PATCH')
          return siteService.updateSite(actor, org, s[3], await readBody(request));
        if (s.length === 4 && method === 'DELETE') return siteService.archiveSite(actor, org, s[3]);
        if (s.length === 5 && s[4] === 'attributes' && method === 'POST')
          return siteService.addAttributes(actor, org, s[3], await readBody(request));
        if (s[4] === 'meters') {
          if (s.length === 5 && method === 'POST')
            return siteService.saveMeter(actor, org, s[3], await readBody(request));
          if (s.length === 6 && method === 'PATCH')
            return siteService.saveMeter(actor, org, s[3], await readBody(request), s[5]);
          if (s.length === 6 && method === 'DELETE') return siteService.archiveMeter(actor, org, s[3], s[5]);
        }
      }
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
