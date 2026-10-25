import type { Client } from '@libsql/client/web';
import { badRequest, forbidden } from '../errors.ts';
import { canReadRecord } from '../access.ts';
import type { Member, RecordItem } from '../types.ts';

export interface ContactPage {
  readonly contacts: RecordItem[];
  readonly next: number | null;
}

export async function searchContacts(client: Client, member: Member, search: string, offset: number): Promise<ContactPage> {
  if (member.role === 'guest') throw forbidden();
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw badRequest('Invalid contact page.');
  const term = search.trim();
  if (term.length > 120) throw badRequest('Contact search is too long.');

  const allowed = member.workRole === 'cashier' ? "type='person'" : "type IN ('person','organization')";
  const result = await client.execute({
    sql: `SELECT id,type,title,state,data,owner,assignee,version,created,updated
      FROM records WHERE ${allowed} AND archived IS NULL
      AND (?='' OR instr(lower(title),lower(?))>0
        OR instr(lower(COALESCE(json_extract(data,'$.email'),'')),lower(?))>0
        OR instr(lower(COALESCE(json_extract(data,'$.phone'),'')),lower(?))>0)
      ORDER BY title COLLATE NOCASE,id LIMIT 31 OFFSET ?`,
    args: [term, term, term, term, offset],
  });
  const rows = result.rows.slice(0, 30).map((row): RecordItem => ({
    id: String(row.id), type: String(row.type), title: String(row.title), state: String(row.state),
    data: JSON.parse(String(row.data)) as Record<string, unknown>,
    owner: typeof row.owner === 'string' ? row.owner : null,
    assignee: typeof row.assignee === 'string' ? row.assignee : null,
    version: Number(row.version), createdAt: Number(row.created), updatedAt: Number(row.updated),
  }));
  return { contacts: rows.filter((row) => canReadRecord(member, row)), next: result.rows.length > 30 ? offset + 30 : null };
}
