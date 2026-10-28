import { sessionToken } from './tar';

const HARNESS = process.env.EXPO_PUBLIC_TARHARNESS_URL || 'https://tarharness.tar-54d.workers.dev';

export async function inviteMember(ws: string, body: Record<string, unknown>): Promise<void> {
  const token = await sessionToken();
  const response = await fetch(`${HARNESS}/v1/workspaces/${ws}/members`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('The invite failed.');
}
