// The channel tool: one tool, adapters inside. Adapter -> registered action
// -> channel; built at build time, no model on run.
//
//   whatsapp-manual  wa.me deep link on the phone; the app logs the exchange
//                    through channel.log
//   telegram-notify  send-only bot alerts (low stock, closing), Tile 5's bell

import type { Client } from '@libsql/client/web';
import { badRequest } from '../errors.ts';
import type { AccessContext } from '../types.ts';
import { commitWrite, currentStatement, inboxStatement, moveHash, moveStatement } from '../truth/write.ts';

export interface ChannelMessage {
  readonly channel: 'whatsapp' | 'telegram';
  readonly contact: string | null;
  readonly phone: string | null;
  readonly text: string;
  readonly direction: 'out' | 'in';
}

/** channel.log: the exchange becomes a record + move. One write, one ledger row. */
export async function executeChannelLog(client: Client, context: AccessContext, input: Record<string, unknown>, key: string): Promise<Record<string, unknown>> {
  const channel = input.channel === 'telegram' ? 'telegram' : input.channel === 'whatsapp' ? 'whatsapp' : null;
  if (!channel) throw badRequest('Channel must be whatsapp or telegram.');
  const text = typeof input.text === 'string' ? input.text.trim().slice(0, 2000) : '';
  const direction = input.direction === 'in' ? 'in' : 'out';
  if (!text) throw badRequest('A message needs text.');
  const phone = typeof input.phone === 'string' ? input.phone.replace(/[^+0-9]/g, '').slice(0, 20) || null : null;
  const contact = typeof input.contact === 'string' && input.contact ? input.contact : null;
  const at = Date.now();
  const id = `msg_${crypto.randomUUID()}`;
  const message: ChannelMessage = { channel, contact, phone, text, direction };
  const hash = await moveHash({ actor: context.identity.id, action: 'channel.log', input });
  await client.batch([
    { sql: 'INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES (?,\'channel.message\',?,?,?, ?,1,?,?)', args: [id, text.slice(0, 60), direction === 'in' ? 'received' : 'sent', JSON.stringify({ ...message, at }), context.identity.id, at, at] },
    moveStatement({ kind: 'channel.log', actor: context.identity.id, key, hash, action: 'channel.log', recordId: id, result: { message: { ...message, id, at } } }),
    currentStatement('card', 'channel', { pendingChats: '0' }),
    ...(direction === 'in' ? [inboxStatement({ member: context.identity.id, tool: 'channel', reach: 'customer', title: `Reply from ${phone ?? 'a customer'}`, action: null })] : []),
  ], 'write');
  return { message: { ...message, id, at } };
}

/** channel.send: the telegram adapter. Send-only, fire-and-log. */
export async function executeChannelSend(client: Client, context: AccessContext, input: Record<string, unknown>, key: string, botToken: string | undefined): Promise<Record<string, unknown>> {
  const to = typeof input.to === 'string' ? input.to.trim().slice(0, 60) : '';
  const text = typeof input.text === 'string' ? input.text.trim().slice(0, 2000) : '';
  if (!to || !text) throw badRequest('A send needs a destination and text.');
  const method = input.method === 'telegram' ? 'telegram' : input.method === 'whatsapp' ? 'whatsapp' : null;
  if (!method) throw badRequest('Send method must be whatsapp or telegram.');
  if (method === 'whatsapp') {
    // Manual by law for now: the phone opens wa.me; the app logs it.
    return { method, to, text, handoff: `https://wa.me/${to.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}` };
  }
  if (!botToken) throw badRequest('The telegram adapter is not configured.');
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: to, text }),
    signal: AbortSignal.timeout(8_000),
  });
  const delivered = response.ok;
  const hash = await moveHash({ actor: context.identity.id, action: 'channel.send', input });
  await commitWrite(client, [
    moveStatement({ kind: 'channel.send', actor: context.identity.id, key, hash, action: 'channel.send', result: { to, method, delivered } }),
  ]);
  if (!delivered) throw badRequest('The telegram send failed.');
  return { to, method, delivered: true };
}
