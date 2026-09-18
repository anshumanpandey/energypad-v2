import { redirect } from 'next/navigation';
export default async function Organisation({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  redirect(`/org/${organisationId}/overview`);
}
