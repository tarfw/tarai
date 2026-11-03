import { intent } from './tar';

export async function inviteMember(ws: string, body: Record<string, unknown>): Promise<void> {
  await intent(ws, 'member.invite', body, `invite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}
