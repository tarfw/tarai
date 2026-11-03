// TAR workspace actor — 1 workspace = 1 actor + 1 SQLite (tarfw spec).
// Serves two faces:
//   • core actions (newSale, setStatus, ledger…) — the tarfw rules
//   • app facade (slice, intent, toolRows, record, actionCatalogs) — the
//     tarapp contract: "the app is a window — a session, a slice, intents".
// Rules baked in: one work shape (kind/channel/status/paid) · append-only
// ledger (cash/bank/credit) · never block a counter sale on stock · owner
// picks invite role · automations = 1 trigger + 1 action (max 8) · integer
// minor units · UTC.
import { actor, event, setup, UserError } from "rivetkit";
import { db } from "rivetkit/db";

type Role = "owner" | "staff" | "driver";
type Kind = "order" | "delivery" | "trip" | "job" | "task";
type Channel = "pos" | "web" | "whatsapp";

const FLOW: Record<Kind, string[]> = {
  order: ["new", "packed", "done"],
  delivery: ["assigned", "picked", "delivered"],
  trip: ["requested", "ongoing", "done"],
  job: ["booked", "in progress", "done"],
  task: ["open", "done"],
};

// recipes: card name -> which work kind feeds it (spec: Home by business type)
const RECIPES: Record<string, string[]> = {
  store: ["sell", "stock", "money", "reach", "people"],
  delivery: ["deliveries", "stock", "money", "people"],
  food: ["deliveries", "money", "people"],
  taxi: ["trips", "money", "people"],
  service: ["jobs", "stock", "money", "people"],
  personal: ["tasks", "health", "plans"],
};

// canvas card -> the section (toolId) it opens in the app
const CARD_TOOL: Record<string, string> = {
  sell: "order", deliveries: "delivery", trips: "trip", jobs: "job",
  tasks: "task", health: "task", plans: "task",
  stock: "stock", money: "register", reach: "site", people: "member",
};

export const workspace = actor({
  db: db({
    onMigrate: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS meta (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS members (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          code TEXT UNIQUE,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT
        );
        CREATE TABLE IF NOT EXISTS stock (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price INTEGER NOT NULL,          -- minor units
          qty INTEGER NOT NULL             -- may go negative → reconcile item
        );
        CREATE TABLE IF NOT EXISTS work (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,              -- order | delivery | trip | job | task
          category TEXT,                   -- personal: health | plans
          channel TEXT NOT NULL,           -- pos | web | whatsapp | internal
          status TEXT NOT NULL,
          paid TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | part | full
          amount INTEGER NOT NULL DEFAULT 0,
          assignee_id TEXT,
          customer_id TEXT,
          ref TEXT,                        -- e.g. table#, vehicle# (POS layout)
          client_req TEXT UNIQUE,          -- stable id: retry = same result
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS work_lines (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL REFERENCES work(id),
          stock_id TEXT,
          name TEXT NOT NULL,
          qty INTEGER NOT NULL,
          price INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ledger (  -- append-only; no UPDATE, no DELETE
          id TEXT PRIMARY KEY,
          bucket TEXT NOT NULL,            -- cash | bank
          amount INTEGER NOT NULL,         -- signed minor units
          category TEXT NOT NULL,
          work_id TEXT,
          party_id TEXT,                   -- credit (party balance) rows
          reversal_of TEXT,                -- corrections link back
          note TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS automations (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,              -- tap | schedule | event
          name TEXT NOT NULL,
          trigger_json TEXT NOT NULL,
          action_json TEXT NOT NULL,       -- { type: 'notify', message }
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_work_status ON work(status);
        CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger(party_id);
      `);
    },
  }),

  events: {
    work_changed: event<{ kind: string; work: any }>(),
    stock_changed: event<{ stock: any }>(),
    ledger_changed: event<{ entry: any }>(),
    member_joined: event<{ member: any }>(),
    automations_changed: event<{}>(),
    automation_fired: event<{ id: string; name: string; output: string }>(),
  },

  actions: {
    // ── workspace birth ─────────────────────────────────────────────
    createWorkspace: async (c, p: { name: string; type: string; ownerName: string }) => {
      const now = Date.now();
      await c.db.execute("INSERT INTO meta (id, name, type, created_at) VALUES (1, ?, ?, ?)",
        p.name, p.type, now);
      const ownerId = crypto.randomUUID();
      await c.db.execute(
        "INSERT INTO members (id, name, role, created_at) VALUES (?, ?, 'owner', ?)",
        ownerId, p.ownerName, now);
      return { ownerId, name: p.name, type: p.type };
    },

    meta: async (c) => {
      const r: any = await c.db.execute("SELECT name, type FROM meta WHERE id = 1");
      return r[0] ?? null;
    },

    // ── people (owner picks the role BEFORE the link — spec rule) ──
    invite: async (c, p: { byId: string; name: string; role: Role }) => {
      await requireRole(c, p.byId, "owner");
      return runInvite(c, p);
    },

    acceptInvite: async (c, p: { code: string }) => {
      const r: any = await c.db.execute("SELECT id, name, role FROM members WHERE code = ?", p.code);
      if (!r[0]) throw new UserError("unknown code");
      return r[0];
    },

    // ── stock (never blocks a sale; negative → reconcile) ──────────
    addStock: async (c, p: { byId: string; name: string; price: number; qty: number }) => {
      await requireRole(c, p.byId, "staff");
      return runAddStock(c, p);
    },

    stockAdjust: async (c, p: { byId: string; stockId: string; delta: number; note?: string }) => {
      await requireRole(c, p.byId, "staff");
      return runStockAdjust(c, p);
    },

    // ── work: one shape for every kind ──────────────────────────────
    newSale: async (c, p: {
      byId: string; lines: { stockId?: string; name: string; qty: number; price: number }[];
      pay: number; bucket?: "cash" | "bank"; customerName?: string; ref?: string; clientReq?: string;
    }) => {
      await requireRole(c, p.byId, "staff");
      return runNewSale(c, p);
    },

    newWork: async (c, p: {
      byId: string; kind: Kind; category?: string; customerName?: string; assigneeId?: string;
      ref?: string; amount?: number; channel?: Channel; clientReq?: string;
    }) => {
      await requireRole(c, p.byId, "staff");
      return runNewWork(c, p);
    },

    setStatus: async (c, p: { byId: string; workId: string; status: string }) => {
      return runSetStatus(c, p);
    },

    payWork: async (c, p: { byId: string; workId: string; amount: number; bucket: "cash" | "bank" }) => {
      await requireRole(c, p.byId, "staff");
      return runPayWork(c, p);
    },

    // ── money: append-only ledger; correction = linked reversal ────
    ledgerEntry: async (c, p: {
      byId: string; bucket: "cash" | "bank"; amount: number; category: string;
      note?: string; partyId?: string; workId?: string; reversalOf?: string;
    }) => {
      await requireRole(c, p.byId, "staff");
      return runLedgerEntry(c, p);
    },

    // ── automations: 1 trigger + 1 action, max 8 ───────────────────
    addAutomation: async (c, p: {
      byId: string; kind: "tap" | "schedule" | "event"; name: string;
      trigger: { cron?: string; event?: string; threshold?: number };
      action: { type: "notify"; message: string };
    }) => {
      await requireRole(c, p.byId, "owner");
      return runAddAutomation(c, p);
    },

    removeAutomation: async (c, p: { byId: string; id: string }) => {
      await requireRole(c, p.byId, "owner");
      await c.db.execute("DELETE FROM automations WHERE id = ?", p.id);
      await c.cron.delete(`auto-${p.id}`).catch(() => {});
      c.broadcast("automations_changed", {});
      return true;
    },

    runAutomation: async (c, id: string) => {
      const a: any = (await c.db.execute("SELECT * FROM automations WHERE id = ? AND enabled = 1", id))[0];
      if (!a) return "disabled";
      const output = JSON.parse(a.action_json).message; // Phase 1: notify only
      c.broadcast("automation_fired", { id: a.id, name: a.name, output });
      return output;
    },

    // ── Ask: deterministic answers now; Jev joins later (never on the sale path) ──
    ask: async (c, p: { byId: string; q: string }) => {
      await requireRole(c, p.byId, "staff");
      return runAsk(c, p.q);
    },

    // ════════════════════════════════════════════════════════════════
    // APP FACADE — the tarapp contract: a session, a slice, intents.
    // ════════════════════════════════════════════════════════════════

    // The slice: everything Home renders, in one small object.
    slice: async (c, p: { byId: string }) => {
      const me = await requireRole(c, p.byId, "driver");
      const meta: any = (await c.db.execute("SELECT name, type FROM meta WHERE id = 1"))[0];
      const recipe = RECIPES[meta.type] ?? RECIPES.store;
      const visible = me.role === "driver"
        ? recipe.filter((k: string) => ["sell", "deliveries", "trips", "jobs", "tasks"].includes(k))
        : recipe;

      const open: any = await c.db.execute(
        `SELECT w.*, c.name AS customer FROM work w LEFT JOIN customers c ON c.id = w.customer_id
         WHERE w.status NOT IN ('done', 'delivered')
         ${me.role === "driver" ? "AND assignee_id = ?" : ""}
         ORDER BY w.updated_at DESC LIMIT 12`,
        ...(me.role === "driver" ? [me.id] : []));
      const toRow = (w: any): object => ({
        id: w.id,
        tool: CARD_TOOL[w.kind === "order" ? "sell" : w.kind === "delivery" ? "deliveries" : w.kind === "trip" ? "trips" : w.kind === "job" ? "jobs" : "tasks"] ?? w.kind,
        reach: w.channel,
        due: null,
        status: w.status,
        title: `${w.customer ?? w.ref ?? w.kind + " " + String(w.id).slice(0, 6)} · ${nextStatus(w.kind, w.status)} →`,
        urgent: false,
        action: "work.advance",
        input: { workId: w.id, status: nextStatus(w.kind, w.status) },
        created: w.created_at,
      });
      const next = open[0] ? toRow(open[0]) : null;
      const inbox = open.slice(0, 12).map(toRow);

      const cards = [];
      for (const card of visible) {
        const value = await cardValue(c, card, me);
        cards.push({
          tool: CARD_TOOL[card] ?? card,
          title: card,
          reach: "",
          shape: card === "sell" ? "sale" : "",
          tap: { action: null, label: "Open" },
          value,
        });
      }

      const autos: any = await c.db.execute(
        "SELECT id, name, trigger_json FROM automations WHERE kind = 'tap' AND enabled = 1");
      const skills = autos.map((a: any) => ({
        id: a.id,
        title: a.name,
        trigger: { type: "tap" },
        steps: [],
      }));

      return {
        version: String(Date.now()),
        next, inbox, cards, skills,
        workspace: { name: meta.name, type: meta.type, role: me.role },
      };
    },

    // intents: the app's named moves, gated and dispatched server-side.
    intent: async (c, p: { byId: string; action: string; input: Record<string, any>; key?: string; confirmed?: boolean }) => {
      const input = p.input ?? {};
      const byId = p.byId;
      switch (p.action) {
        case "sale.write": {
          const lines = [];
          for (const line of (input.lines ?? []) as { variant: string; quantity: number }[]) {
            const s: any = (await c.db.execute("SELECT * FROM stock WHERE id = ?", line.variant))[0];
            if (!s) throw new UserError("unknown item");
            lines.push({ stockId: s.id, name: s.name, qty: line.quantity, price: s.price });
          }
          const method = input.method ?? "cash";
          const pay = sumLines(lines);
          return runNewSale(c, {
            byId, lines, pay,
            bucket: method === "cash" ? "cash" : "bank",
            ref: input.reference ?? undefined,
            clientReq: p.key ?? undefined,
          });
        }
        case "catalog.item.save": {
          const stock = await runAddStock(c, {
            name: String(input.name ?? "").trim(),
            price: Math.round(Number(input.price ?? 0)),
            qty: Math.round(Number(input.qty ?? 0)),
          });
          return { result: { id: stock.id } };
        }
        case "stock.adjust": {
          const rows: any = input.stockId
            ? await c.db.execute("SELECT id FROM stock WHERE id = ?", input.stockId)
            : await c.db.execute("SELECT id FROM stock WHERE name = ?", String(input.name ?? ""));
          if (!rows[0]) throw new UserError("unknown item");
          const stock = await runStockAdjust(c, {
            stockId: rows[0].id, delta: Math.round(Number(input.delta ?? 0)), note: input.note,
          });
          return { result: { id: stock.id, qty: stock.qty } };
        }
        case "expense.record": {
          const entry = await runLedgerEntry(c, {
            bucket: input.bucket === "bank" ? "bank" : "cash",
            amount: -Math.abs(Math.round(Number(input.amount ?? 0))),
            category: "expense", note: input.name ?? input.note,
          });
          return { result: { id: entry.id } };
        }
        case "purchase.create": {
          const entry = await runLedgerEntry(c, {
            bucket: input.bucket === "bank" ? "bank" : "cash",
            amount: -Math.abs(Math.round(Number(input.amount ?? 0))),
            category: "purchase", note: input.name ?? input.note,
          });
          return { result: { id: entry.id } };
        }
        case "payment.record": {
          const work = await runPayWork(c, {
            workId: String(input.workId ?? ""),
            amount: Math.round(Number(input.amount ?? 0)),
            bucket: input.bucket === "cash" ? "cash" : "bank",
          });
          return { result: { id: work.id, paid: work.paid } };
        }
        case "contact.create": {
          const id = crypto.randomUUID();
          await c.db.execute("INSERT INTO customers (id, name, phone) VALUES (?, ?, ?)",
            id, String(input.name ?? "").trim(), input.phone ?? null);
          return { result: { id } };
        }
        case "task.create": {
          const work = await runNewWork(c, {
            kind: "task", category: input.category,
            ref: String(input.name ?? input.title ?? "").trim() || "task",
          });
          return { result: { id: work.id } };
        }
        case "work.advance": {
          const work = await runSetStatus(c, {
            byId, workId: String(input.workId ?? ""), status: String(input.status ?? ""),
          });
          return { result: { id: work.id, status: work.status } };
        }
        case "member.invite": {
          const raw = String(input.name ?? input.email ?? "").trim();
          const role: Role = input.role === "driver" || input.workRole === "driver" ? "driver" : "staff";
          const invited = await runInvite(c, { name: raw, role });
          return { result: { memberId: invited.memberId, code: invited.code, role } };
        }
        case "automation.create": {
          const kind = input.trigger?.type === "schedule" ? "schedule"
            : input.trigger?.type === "event" ? "event" : "tap";
          const trigger = kind === "schedule"
            ? { cron: cronFromAt(input.trigger?.at ?? "08:00") }
            : kind === "event"
              ? { event: "stock_below", threshold: Number(input.trigger?.threshold ?? 2) }
              : {};
          const auto = await runAddAutomation(c, {
            kind, name: String(input.title ?? "Automation").trim(),
            trigger, action: { type: "notify", message: input.message ?? input.title ?? "Automation ran" },
          });
          return { result: { id: auto.id } };
        }
        case "automation.remove": {
          await requireRole(c, byId, "owner");
          await c.db.execute("DELETE FROM automations WHERE id = ?", String(input.id ?? ""));
          await c.cron.delete(`auto-${String(input.id ?? "")}`).catch(() => {});
          c.broadcast("automations_changed", {});
          return { result: {} };
        }
        default:
          throw new UserError("That move is not available yet.");
      }
    },

    // Section lists: flat rows, one per record (spec: Section = Lists + forms).
    toolRows: async (c, p: { byId: string; toolId: string; q?: string; offset?: number }) => {
      const staffTools = ["catalog", "stock", "register", "expense", "payment", "purchase", "contact", "member", "invoice"];
      await requireRole(c, p.byId, staffTools.includes(p.toolId) ? "staff" : "driver");
      const q = (p.q ?? "").toLowerCase();
      const match = (title: string) => !q || title.toLowerCase().includes(q);
      let rows: any[] = [];
      switch (p.toolId) {
        case "catalog": case "stock": {
          const stock: any = await c.db.execute("SELECT * FROM stock ORDER BY name");
          rows = stock.filter((s: any) => match(s.name)).map((s: any) => ({
            id: s.id, type: "stock", title: s.name,
            state: s.qty < 0 ? "negative" : s.qty <= 2 ? "low" : "ok",
            data: { price: s.price, qty: s.qty }, version: 1, updatedAt: Date.now(),
          }));
          break;
        }
        case "contact": {
          const cs: any = await c.db.execute("SELECT * FROM customers ORDER BY name");
          rows = cs.filter((x: any) => match(x.name)).map((x: any) => ({
            id: x.id, type: "contact", title: x.name, state: "ok",
            data: { phone: x.phone ?? "" }, version: 1, updatedAt: Date.now(),
          }));
          break;
        }
        case "member": {
          const ms: any = await c.db.execute("SELECT id, name, role, created_at FROM members ORDER BY created_at");
          rows = ms.filter((x: any) => match(x.name)).map((x: any) => ({
            id: x.id, type: "member", title: x.name, state: x.role,
            data: { role: x.role }, version: 1, updatedAt: x.created_at,
          }));
          break;
        }
        case "order": case "pos": case "delivery": case "trip": case "job": case "task": {
          const kind = p.toolId === "order" || p.toolId === "pos" ? "order" : p.toolId;
          const work: any = await c.db.execute(
            `SELECT w.*, c.name AS customer FROM work w LEFT JOIN customers c ON c.id = w.customer_id
             WHERE w.kind = ? ORDER BY w.created_at DESC LIMIT 100`, kind);
          rows = work
            .filter((w: any) => match(`${w.customer ?? ""} ${w.ref ?? ""} ${w.id}`))
            .map((w: any) => ({
              id: w.id, type: w.kind, title: w.customer ?? w.ref ?? `Order ${String(w.id).slice(0, 6)}`,
              state: w.status,
              data: { amount: w.amount, paid: w.paid, channel: w.channel, status: w.status },
              version: 1, updatedAt: w.updated_at,
            }));
          break;
        }
        case "register": {
          const led: any = await c.db.execute("SELECT * FROM ledger ORDER BY created_at DESC LIMIT 100");
          rows = led.filter((e: any) => match(`${e.category} ${e.note ?? ""}`)).map((e: any) => ({
            id: e.id, type: "ledger", title: `${e.category}${e.note ? " · " + e.note : ""}`,
            state: e.bucket, data: { amount: e.amount, bucket: e.bucket, reversal_of: e.reversal_of ?? "", party_id: e.party_id ?? "" }, version: 1, updatedAt: e.created_at,
          }));
          break;
        }
        case "expense": case "payment": case "purchase": {
          const cat = p.toolId === "expense" ? "expense" : p.toolId === "payment" ? "sale" : "purchase";
          const led: any = await c.db.execute(
            "SELECT * FROM ledger WHERE category = ? ORDER BY created_at DESC LIMIT 100", cat);
          rows = led.filter((e: any) => match(`${e.category} ${e.note ?? ""}`)).map((e: any) => ({
            id: e.id, type: "ledger", title: `${e.category}${e.note ? " · " + e.note : ""}`,
            state: e.bucket,
            data: { amount: e.amount, bucket: e.bucket, reversal_of: e.reversal_of ?? "", party_id: e.party_id ?? "" },
            version: 1, updatedAt: e.created_at,
          }));
          break;
        }
        case "site": {
          rows = [{
            id: "site", type: "site", title: "Store link", state: "ready",
            data: { url: `https://tars93k.onrivet.dev/store/${c.key?.[0] ?? ""}` },
            version: 1, updatedAt: Date.now(),
          }];
          break;
        }
        default:
          rows = [];
      }
      const offset = p.offset ?? 0;
      return { rows: rows.slice(offset, offset + 100), total: rows.length };
    },

    // One record, any tool: read + the facts tile.
    record: async (c, p: { byId: string; id: string }) => {
      await requireRole(c, p.byId, "driver");
      const w: any = (await c.db.execute(
        "SELECT w.*, c.name AS customer FROM work w LEFT JOIN customers c ON c.id = w.customer_id WHERE w.id = ?",
        p.id))[0];
      if (w) {
        const lines: any = await c.db.execute("SELECT name, qty, price FROM work_lines WHERE work_id = ?", p.id);
        return { record: {
          id: w.id, type: w.kind, title: w.customer ?? w.ref ?? `Order ${String(w.id).slice(0, 6)}`,
          state: w.status, version: 1,
          data: { amount: w.amount, paid: w.paid, channel: w.channel, ref: w.ref ?? "", customer: w.customer ?? "", lines: lines.length },
        } };
      }
      const s: any = (await c.db.execute("SELECT * FROM stock WHERE id = ?", p.id))[0];
      if (s) return { record: { id: s.id, type: "stock", title: s.name, state: String(s.qty), version: 1, data: { price: s.price, qty: s.qty } } };
      const cu: any = (await c.db.execute("SELECT * FROM customers WHERE id = ?", p.id))[0];
      if (cu) return { record: { id: cu.id, type: "contact", title: cu.name, state: "ok", version: 1, data: { phone: cu.phone ?? "" } } };
      const m: any = (await c.db.execute("SELECT id, name, role, created_at FROM members WHERE id = ?", p.id))[0];
      if (m) return { record: { id: m.id, type: "member", title: m.name, state: m.role, version: 1, data: { role: m.role } } };
      const e: any = (await c.db.execute("SELECT * FROM ledger WHERE id = ?", p.id))[0];
      if (e) return { record: { id: e.id, type: "ledger", title: e.category, state: e.bucket, version: 1, data: { amount: e.amount, bucket: e.bucket, note: e.note ?? "" } } };
      throw new UserError("not found");
    },

    // The + forms: field lists the app renders as the ActionSheet.
    actionCatalogs: async (c, p: { byId: string }) => {
      await requireRole(c, p.byId, "driver");
      return { actions: [
        { id: "catalog.item.save", fields: [
          { key: "name", label: "Item", kind: "text", required: true },
          { key: "price", label: "Price", kind: "money", required: true },
          { key: "qty", label: "Qty", kind: "number" },
        ] },
        { id: "stock.adjust", fields: [
          { key: "name", label: "Item", kind: "text", required: true },
          { key: "delta", label: "Change (+/-)", kind: "number", required: true },
          { key: "note", label: "Note", kind: "text" },
        ] },
        { id: "expense.record", fields: [
          { key: "name", label: "What", kind: "text", required: true },
          { key: "amount", label: "Amount", kind: "money", required: true },
          { key: "bucket", label: "Bucket", kind: "options", options: ["cash", "bank"] },
        ] },
        { id: "purchase.create", fields: [
          { key: "name", label: "What", kind: "text", required: true },
          { key: "amount", label: "Amount", kind: "money", required: true },
          { key: "bucket", label: "Bucket", kind: "options", options: ["cash", "bank"] },
        ] },
        { id: "payment.record", fields: [
          { key: "workId", label: "Order id", kind: "text", required: true },
          { key: "amount", label: "Amount", kind: "money", required: true },
          { key: "bucket", label: "Bucket", kind: "options", options: ["cash", "bank"] },
        ] },
        { id: "contact.create", fields: [
          { key: "name", label: "Name", kind: "text", required: true },
          { key: "phone", label: "Phone", kind: "text" },
        ] },
        { id: "task.create", fields: [
          { key: "name", label: "Task", kind: "text", required: true },
          { key: "category", label: "Deck", kind: "options", options: ["tasks", "health", "plans"] },
        ] },
        { id: "member.invite", fields: [
          { key: "name", label: "Name or email", kind: "text", required: true },
          { key: "role", label: "Role", kind: "options", options: ["staff", "driver"] },
        ] },
      ] };
    },
  },
});

// ── core runners (shared by actions + intents) ──────────────────────
async function runAddStock(c: any, p: { name: string; price: number; qty: number }) {
  const id = crypto.randomUUID();
  await c.db.execute("INSERT INTO stock (id, name, price, qty) VALUES (?, ?, ?, ?)",
    id, p.name, p.price, p.qty);
  const stock = (await c.db.execute("SELECT * FROM stock WHERE id = ?", id))[0];
  c.broadcast("stock_changed", { stock });
  return stock;
}

async function runStockAdjust(c: any, p: { stockId: string; delta: number; note?: string }) {
  await c.db.execute("UPDATE stock SET qty = qty + ? WHERE id = ?", p.delta, p.stockId);
  const stock: any = (await c.db.execute("SELECT * FROM stock WHERE id = ?", p.stockId))[0];
  if (!stock) throw new UserError("no such item");
  if (stock.qty < 0) await fireStockBelow(c); // reconcile item surfaces in STOCK
  c.broadcast("stock_changed", { stock, note: p.note });
  return stock;
}

function sumLines(lines: { qty: number; price: number }[]) {
  return lines.reduce((sum, l) => sum + l.qty * l.price, 0);
}

async function runNewSale(c: any, p: {
  byId: string; lines: { stockId?: string; name: string; qty: number; price: number }[];
  pay: number; bucket?: "cash" | "bank"; customerName?: string; ref?: string; clientReq?: string;
}) {
  if (p.clientReq) {
    const dup: any = await c.db.execute("SELECT id FROM work WHERE client_req = ?", p.clientReq);
    if (dup[0]) return (await c.db.execute("SELECT * FROM work WHERE id = ?", dup[0].id))[0];
  }
  const total = sumLines(p.lines);
  const paid = p.pay >= total ? "full" : p.pay > 0 ? "part" : "unpaid";
  const work = await c.db.transaction(async (tx: any) => {
    const id = crypto.randomUUID(), now = Date.now();
    let customerId = null;
    if (p.customerName) {
      customerId = crypto.randomUUID();
      await tx.execute("INSERT INTO customers (id, name) VALUES (?, ?)", customerId, p.customerName);
    }
    // POS sale = insert directly as done (channel pos)
    await tx.execute(
      `INSERT INTO work (id, kind, channel, status, paid, amount, customer_id, ref, client_req, created_at, updated_at)
       VALUES (?, 'order', 'pos', 'done', ?, ?, ?, ?, ?, ?, ?)`,
      id, paid, total, customerId, p.ref ?? null, p.clientReq ?? null, now, now);
    for (const l of p.lines) {
      await tx.execute(
        "INSERT INTO work_lines (id, work_id, stock_id, name, qty, price) VALUES (?, ?, ?, ?, ?, ?)",
        crypto.randomUUID(), id, l.stockId ?? null, l.name, l.qty, l.price);
      if (l.stockId) await tx.execute("UPDATE stock SET qty = qty - ? WHERE id = ?", l.qty, l.stockId);
    }
    if (p.pay > 0) {
      await tx.execute(
        "INSERT INTO ledger (id, bucket, amount, category, work_id, note, created_at) VALUES (?, ?, ?, 'sale', ?, ?, ?)",
        crypto.randomUUID(), p.bucket ?? "cash", p.pay, id, `sale ${id.slice(0, 8)}`, now);
    }
    return (await tx.execute("SELECT * FROM work WHERE id = ?", id))[0];
  }, { name: "new-sale" });
  // broadcast + event checks only AFTER commit (outer db queues behind an open transaction)
  c.broadcast("work_changed", { kind: "new_sale", work });
  await fireStockBelow(c);
  return work;
}

async function runNewWork(c: any, p: {
  kind: Kind; category?: string; customerName?: string; assigneeId?: string;
  ref?: string; amount?: number; channel?: Channel; clientReq?: string;
}) {
  const status = FLOW[p.kind][0];
  const id = crypto.randomUUID(), now = Date.now();
  let customerId = null;
  if (p.customerName) {
    customerId = crypto.randomUUID();
    await c.db.execute("INSERT INTO customers (id, name) VALUES (?, ?)", customerId, p.customerName);
  }
  await c.db.execute(
    `INSERT INTO work (id, kind, category, channel, status, amount, assignee_id, customer_id, ref, client_req, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, p.kind, p.category ?? null, p.channel ?? "internal", status, p.amount ?? 0,
    p.assigneeId ?? null, customerId, p.ref ?? null, p.clientReq ?? null, now, now);
  const work = (await c.db.execute("SELECT * FROM work WHERE id = ?", id))[0];
  c.broadcast("work_changed", { kind: "new_work", work });
  return work;
}

function nextStatus(kind: string, status: string): string {
  const flow = FLOW[kind as Kind] ?? [];
  const i = flow.indexOf(status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : status;
}

async function runSetStatus(c: any, p: { byId: string; workId: string; status: string }) {
  const me = await requireRole(c, p.byId, "driver"); // any member may act…
  const w: any = (await c.db.execute("SELECT * FROM work WHERE id = ?", p.workId))[0];
  if (!w) throw new UserError("no such work");
  const flow = FLOW[w.kind as Kind];
  const isStaff = me.role === "owner" || me.role === "staff";
  // …but drivers only on work assigned to them; staff on everything
  if (!isStaff && w.assignee_id !== me.id) throw new UserError("not yours");
  const from = flow.indexOf(w.status), to = flow.indexOf(p.status);
  if (to === -1) throw new UserError(`bad status for ${w.kind}`);
  if (to !== from + 1) throw new UserError(`${w.status} → ${p.status} skips the flow`);
  await c.db.execute("UPDATE work SET status = ?, updated_at = ? WHERE id = ?",
    p.status, Date.now(), p.workId);
  const work = (await c.db.execute("SELECT * FROM work WHERE id = ?", p.workId))[0];
  c.broadcast("work_changed", { kind: "status", work });
  return work;
}

async function runPayWork(c: any, p: { workId: string; amount: number; bucket: "cash" | "bank" }) {
  const w: any = (await c.db.execute("SELECT * FROM work WHERE id = ?", p.workId))[0];
  if (!w) throw new UserError("no such work");
  const work = await c.db.transaction(async (tx: any) => {
    await tx.execute(
      "INSERT INTO ledger (id, bucket, amount, category, work_id, note, created_at) VALUES (?, ?, ?, 'sale', ?, ?, ?)",
      crypto.randomUUID(), p.bucket, p.amount, p.workId, `payment ${p.workId.slice(0, 8)}`, Date.now());
    const already = await paidSoFar(tx, p.workId);
    const paid = p.amount >= w.amount - already ? "full" : "part";
    await tx.execute("UPDATE work SET paid = ?, updated_at = ? WHERE id = ?",
      paid, Date.now(), p.workId);
    return (await tx.execute("SELECT * FROM work WHERE id = ?", p.workId))[0];
  }, { name: "pay-work" });
  c.broadcast("work_changed", { kind: "payment", work });
  return work;
}

async function runLedgerEntry(c: any, p: {
  bucket: "cash" | "bank"; amount: number; category: string;
  note?: string; partyId?: string; workId?: string; reversalOf?: string;
}) {
  if (p.reversalOf) {
    const orig: any = (await c.db.execute("SELECT * FROM ledger WHERE id = ?", p.reversalOf))[0];
    if (!orig) throw new UserError("no such entry to reverse");
    const done: any = await c.db.execute("SELECT id FROM ledger WHERE reversal_of = ?", p.reversalOf);
    if (done.length) throw new UserError("already reversed");
    p.amount = -orig.amount;
    p.bucket = orig.bucket;
    p.partyId = orig.party_id ?? undefined;
    p.category = orig.category;
  }
  const id = crypto.randomUUID();
  await c.db.execute(
    "INSERT INTO ledger (id, bucket, amount, category, work_id, party_id, reversal_of, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, p.bucket, p.amount, p.category, p.workId ?? null, p.partyId ?? null,
    p.reversalOf ?? null, p.note ?? null, Date.now());
  const entry = (await c.db.execute("SELECT * FROM ledger WHERE id = ?", id))[0];
  c.broadcast("ledger_changed", { entry });
  return entry;
}

async function runInvite(c: any, p: { name: string; role: Role }) {
  if (!["owner", "staff", "driver"].includes(p.role)) throw new UserError("bad role");
  const id = crypto.randomUUID(), code = crypto.randomUUID().slice(0, 8);
  await c.db.execute(
    "INSERT INTO members (id, name, role, code, created_at) VALUES (?, ?, ?, ?, ?)",
    id, p.name, p.role, code, Date.now());
  const member = (await c.db.execute("SELECT * FROM members WHERE id = ?", id))[0];
  c.broadcast("member_joined", { member });
  return { memberId: id, code };
}

async function runAddAutomation(c: any, p: {
  kind: "tap" | "schedule" | "event"; name: string;
  trigger: { cron?: string; event?: string; threshold?: number };
  action: { type: "notify"; message: string };
}) {
  const n: any = await c.db.execute("SELECT COUNT(*) AS n FROM automations");
  if (n[0].n >= 8) throw new UserError("max 8 automations");
  const id = crypto.randomUUID();
  await c.db.execute(
    "INSERT INTO automations (id, kind, name, trigger_json, action_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id, p.kind, p.name, JSON.stringify(p.trigger), JSON.stringify(p.action), Date.now());
  if (p.kind === "schedule" && p.trigger.cron) {
    await c.cron.set({
      name: `auto-${id}`,
      expression: p.trigger.cron,
      action: "runAutomation",
      args: [id],
    });
  }
  c.broadcast("automations_changed", {});
  return (await c.db.execute("SELECT * FROM automations WHERE id = ?", id))[0];
}

function cronFromAt(at: string): string {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(at.trim());
  if (!m) return "0 8 * * *";
  let hour = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (m[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
  return `${min} ${hour} * * *`;
}

async function runAsk(c: any, q: string) {
  const lq = q.toLowerCase();
  if (lq.includes("today") && (lq.includes("sale") || lq.includes("sell"))) {
    const r: any = await c.db.execute(
      "SELECT COALESCE(SUM(amount), 0) AS t FROM ledger WHERE category = 'sale' AND created_at >= ?",
      startOfDay());
    return `Today's sales: Rs.${(r[0].t / 100).toFixed(2)}`;
  }
  if (lq.includes("low") || lq.includes("stock")) {
    const r: any = await c.db.execute("SELECT name, qty FROM stock WHERE qty <= 2 ORDER BY qty");
    return r.length ? r.map((s: any) => `${s.name} ×${s.qty}`).join(", ") : "stock is healthy";
  }
  if (lq.includes("who ordered") || lq.includes("orders")) {
    const r: any = await c.db.execute(
      "SELECT w.id, w.amount, c.name FROM work w LEFT JOIN customers c ON c.id = w.customer_id " +
      "WHERE w.status != 'done' ORDER BY w.created_at DESC LIMIT 5");
    return r.length ? r.map((w: any) => `${w.id.slice(0, 6)} ${w.name ?? "walk-in"} Rs.${w.amount}`).join(", ") : "no open orders";
  }
  return "Try: sales today · low stock · open orders";
}

// ── helpers ─────────────────────────────────────────────────────────
async function requireRole(c: any, memberId: string, min: Role) {
  const r: any = await c.db.execute("SELECT * FROM members WHERE id = ?", memberId);
  const me = r[0];
  if (!me) throw new UserError("unknown member");
  const rank: Record<Role, number> = { driver: 1, staff: 2, owner: 3 };
  if (rank[me.role as Role] < rank[min]) throw new UserError(`${me.role} cannot do this`);
  return me;
}

async function paidSoFar(tx: any, workId: string) {
  const r: any = await tx.execute(
    "SELECT COALESCE(SUM(amount), 0) AS t FROM ledger WHERE work_id = ? AND category = 'sale'", workId);
  return r[0].t;
}

function startOfDay() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// A card is one integer: a count, or an amount in minor units. The words, the
// currency and the decimals belong to the app — it ships on Metro in seconds,
// this actor ships as an image.
async function cardValue(c: any, card: string, me: any): Promise<number | null> {
  const mine = me.role === "driver" ? "AND assignee_id = ?" : "";
  const args = me.role === "driver" ? [me.id] : [];
  switch (card) {
    case "sell": {
      const t: any = await c.db.execute(
        "SELECT COALESCE(SUM(amount), 0) AS t FROM ledger WHERE category = 'sale' AND created_at >= ?",
        startOfDay());
      return t[0].t;
    }
    case "deliveries": case "trips": case "jobs": case "tasks": {
      const kind = card === "deliveries" ? "delivery" : card.slice(0, -1);
      const r: any = await c.db.execute(
        `SELECT COUNT(*) AS n FROM work WHERE kind = ? AND created_at >= ? ${mine}`,
        kind, startOfDay(), ...args);
      return r[0].n;
    }
    case "stock": {
      const r: any = await c.db.execute("SELECT COUNT(*) AS n FROM stock WHERE qty <= 2");
      return r[0].n;
    }
    case "money": {
      const r: any = await c.db.execute("SELECT bucket, SUM(amount) AS t FROM ledger GROUP BY bucket");
      let total = 0;
      for (const row of r) total += row.t;
      return total;
    }
    case "reach": {
      const r: any = await c.db.execute(
        "SELECT COUNT(*) AS n FROM work WHERE channel = 'web' AND created_at >= ?",
        startOfDay());
      return r[0].n;
    }
    case "people": {
      const r: any = await c.db.execute("SELECT COUNT(*) AS n FROM customers");
      return r[0].n;
    }
    case "health": case "plans": {
      const r: any = await c.db.execute(
        "SELECT COUNT(*) AS n FROM work WHERE category = ? AND status = 'open'", card);
      return r[0].n;
    }
    default: return null;
  }
}

async function fireStockBelow(c: any) {
  const autos: any = await c.db.execute(
    "SELECT * FROM automations WHERE kind = 'event' AND enabled = 1");
  for (const a of autos) {
    const t = JSON.parse(a.trigger_json);
    if (t.event !== "stock_below") continue;
    const low: any = await c.db.execute("SELECT name, qty FROM stock WHERE qty <= ?", t.threshold ?? 2);
    if (low.length) {
      c.broadcast("automation_fired", {
        id: a.id, name: a.name,
        output: `low stock: ${low.map((s: any) => `${s.name} ×${s.qty}`).join(", ")}`,
      });
    }
  }
}

// Client-facing registry type (constructed once; runtime start happens below).
const __registryType = setup({ use: { workspace } });
export type registry = typeof __registryType;

// On the runner: connect to the runner's engine (it sets RIVET_ENDPOINT).
// Spawning our own engine (RIVET_RUN_ENGINE=1 default) + endpoint = config error.
const isCloud = !!process.env.RIVET_ENDPOINT;
if (isCloud) {
  const r = setup({ use: { workspace }, endpoint: process.env.RIVET_ENDPOINT, startEngine: false });
  await r.listen({
    port: Number(process.env.PORT ?? 8080),
    application: { fetch: async (request: Request) => {
      const url = new URL(request.url);
      // Phone onboarding: exchange for a namespace-scoped gateway token.
      // Phase 1 is open; invite codes gate this at the Access+safety build-out.
      if (request.method === "POST" && url.pathname === "/mint") {
        const body = await request.json().catch(() => ({}) as any);
        const res = await fetch(`${process.env.RIVET_ENDPOINT}/auth/tokens`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.RIVET_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            subject: String(body.subject ?? "tar-app").slice(0, 64),
            namespace: "default",
            grants: [
              { resource: "actor_gateway", target: "any",
                operations: ["read", "update", "create", "list"] },
              { resource: "actor", target: "any",
                operations: ["read", "update", "create", "delete", "list"] },
            ],
          }),
        });
        return new Response(await res.text(), {
          status: res.status, headers: { "content-type": "application/json" },
        });
      }
      return new Response("TAR actor node", { status: 404 });
    } },
  });
} else {
  const r = setup({ use: { workspace } });
  r.start();
}
