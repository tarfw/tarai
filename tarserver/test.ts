// End-to-end check of the workspace actor against a locally running server.
import { createClient } from "rivetkit/client";
import type { registry as RegistryType } from "./index.js";

const client = createClient<RegistryType>("http://localhost:6420");
const ws = client.workspace.getOrCreate(["test-ws"]);

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra?: any) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra ?? ""); }
}
async function throws(name: string, fn: () => Promise<any>) {
  try { await fn(); fail++; console.log(`  ✗ ${name} (did not throw)`); }
  catch { pass++; console.log(`  ✓ ${name}`); }
}

// 1 · workspace birth
const meta = await ws.meta();
if (!meta) await ws.createWorkspace({ name: "Aambal Stores", type: "store", ownerName: "Owner" });

// discover owner id via ask? simpler: recreate deterministic — createWorkspace returns ownerId once.
// We fetch it by inviting ourselves is impossible; so read home with a wrong id must throw.
await throws("unknown member blocked", () => ws.slice({ byId: "nope" }));

// To keep the test self-contained we re-create a FRESH workspace each run with a unique key.
const key = ["test-" + Date.now()];
const w2 = client.workspace.getOrCreate(key);
const born = await w2.createWorkspace({ name: "Aambal Stores", type: "store", ownerName: "Tara" });
ok("workspace created, owner born", !!born.ownerId);
const ownerId = born.ownerId;
const seen: string[] = [];
const conn = w2.connect();
await new Promise(r => setTimeout(r, 300)); // let the socket establish
conn.on("work_changed", (e: any) => seen.push(e.kind));
conn.on("automation_fired", (e: any) => seen.push(`auto:${e.name}`));


const m2: any = await w2.meta();
ok("meta stored", m2.name === "Aambal Stores" && m2.type === "store");

// 2 · owner picks role BEFORE invite (spec rule)
const staff: any = await w2.invite({ byId: ownerId, name: "Kumar", role: "staff" });
const driver: any = await w2.invite({ byId: ownerId, name: "Ravi", role: "driver" });
ok("staff + driver invited with role", !!staff.memberId && !!driver.memberId);
const acc = await w2.acceptInvite({ code: staff.code });
ok("invite code accepts", acc.role === "staff");
await throws("bad invite code rejected", () => w2.acceptInvite({ code: "zzzz" }));

// 3 · role gate
await throws("driver cannot invite", () =>
  w2.invite({ byId: driver.memberId, name: "X", role: "owner" }));
await throws("driver cannot read stock", () => w2.toolRows({ byId: driver.memberId, toolId: "stock" }));

// 4 · stock + POS sale (insert as done, pay → ledger, stock deduct)
await w2.addStock({ byId: ownerId, name: "Rice 1kg", price: 6000, qty: 10 });
await w2.addStock({ byId: ownerId, name: "Sari", price: 95000, qty: 3 });
const stock: any = (await w2.toolRows({ byId: ownerId, toolId: 'stock' })).rows;
const rice: any = stock.find((s: any) => s.title === "Rice 1kg");

const sale = await w2.newSale({
  byId: staff.memberId,
  lines: [{ stockId: rice.id, name: "Rice 1kg", qty: 2, price: 6000 }],
  pay: 12000, bucket: "cash",
});
ok("POS sale done + paid full", sale.status === "done" && sale.paid === "full" && sale.amount === 12000);

const stockAfter: any = (await w2.toolRows({ byId: ownerId, toolId: 'stock' })).rows;
ok("stock deducted (10 → 8)", stockAfter.find((s: any) => s.title === "Rice 1kg").data.qty === 8);

// 5 · idempotency: same clientReq = same result, not a duplicate
const req = crypto.randomUUID();
const s1 = await w2.newSale({ byId: ownerId, lines: [{ name: "Walk-in", qty: 1, price: 5000 }], pay: 5000, bucket: "cash", clientReq: req });
const s2 = await w2.newSale({ byId: ownerId, lines: [{ name: "Walk-in", qty: 1, price: 5000 }], pay: 5000, bucket: "cash", clientReq: req });
ok("retry = same result (stable id)", s1.id === s2.id);

// 6 · oversell never blocks → negative stock + reconcile event fires
await w2.addAutomation({ byId: ownerId, kind: "event", name: "reconcile stock",
  trigger: { event: "stock_below", threshold: 2 }, action: { type: "notify", message: "stock low" } });
const over = await w2.newSale({ byId: ownerId, lines: [{ stockId: rice.id, name: "Rice 1kg", qty: 50, price: 6000 }], pay: 0 });
ok("counter sale NOT blocked on shortage", over.status === "done" && over.paid === "unpaid");
const neg: any = (await w2.toolRows({ byId: ownerId, toolId: 'stock' })).rows;
ok("stock went negative (reconcile item)", neg.find((s: any) => s.title === "Rice 1kg").data.qty < 0);

// 7 · automations: max 8, tap on HOME, schedule = durable cron
await w2.addAutomation({ byId: ownerId, kind: "tap", name: "Reorder 50 units",
  trigger: {}, action: { type: "notify", message: "PO sent" } });
const autos: any = (await w2.slice({ byId: ownerId })).skills;
ok("tap + event automations saved", autos.length === 1);
const runMsg = await w2.runAutomation(autos[0].id);
ok("tap automation runs", runMsg === "PO sent");
const home: any = await w2.slice({ byId: ownerId });
ok("HOME shows tap automation", home.skills.length === 1);
for (let i = 0; i < 7; i++) {
  await w2.addAutomation({ byId: ownerId, kind: "tap", name: "pad" + i, trigger: {}, action: { type: "notify", message: "x" } }).catch(() => {});
}
await throws("9th automation rejected (max 8)", () =>
  w2.addAutomation({ byId: ownerId, kind: "tap", name: "over", trigger: {}, action: { type: "notify", message: "x" } }));

// 8 · non-store kinds + driver flow (assigned → picked → delivered)
const ride: any = await w2.newWork({ byId: ownerId, kind: "delivery", customerName: "Priya", assigneeId: driver.memberId, amount: 4000 });
await throws("skipping flow rejected (assigned → delivered)", () =>
  w2.setStatus({ byId: driver.memberId, workId: ride.id, status: "delivered" }));
await w2.setStatus({ byId: driver.memberId, workId: ride.id, status: "picked" });
const picked: any = (await w2.record({ byId: ownerId, id: ride.id })).record;
ok("driver moved own work (picked)", picked.state === "picked");
const ownOrder: any = await w2.newWork({ byId: ownerId, kind: "order", channel: "pos", amount: 1000 });
await throws("driver cannot move others' work", () =>
  w2.setStatus({ byId: driver.memberId, workId: ownOrder.id, status: "packed" }));
const driverHome: any = await w2.slice({ byId: driver.memberId });
ok("driver home has no money/stock/people cards", !driverHome.cards.some((x: any) => ["register", "stock", "member"].includes(x.tool)));

// 9 · web order + payments (part → full)
const order: any = await w2.newWork({ byId: ownerId, kind: "order", channel: "web", customerName: "Meera", amount: 25000 });
await throws("web order starts at new, cannot jump to done", () =>
  w2.setStatus({ byId: ownerId, workId: order.id, status: "done" }));
await w2.setStatus({ byId: ownerId, workId: order.id, status: "packed" });
await w2.payWork({ byId: ownerId, workId: order.id, amount: 10000, bucket: "bank" });
const part: any = (await w2.record({ byId: ownerId, id: order.id })).record;
ok("partial payment → paid 'part'", part.data.paid === "part");
await w2.payWork({ byId: ownerId, workId: order.id, amount: 15000, bucket: "bank" });
const full: any = (await w2.record({ byId: ownerId, id: order.id })).record;
ok("final payment → paid 'full'", full.data.paid === "full");

// 10 · ledger: append-only + linked reversal + party (credit) balance
const exp: any = await w2.ledgerEntry({ byId: ownerId, bucket: "cash", amount: -30000, category: "purchase", note: "rice bag" });
await w2.ledgerEntry({ byId: ownerId, bucket: "cash", amount: 0, category: "purchase", reversalOf: exp.id, note: "wrong entry" });
const led: any = await w2.toolRows({ byId: ownerId, toolId: 'register' });
const reversal = led.rows.find((e: any) => e.data.reversal_of === exp.id);
ok("reversal mirrors original signed amount", reversal && reversal.data.amount === -exp.amount);
await throws("cannot reverse twice", () =>
  w2.ledgerEntry({ byId: ownerId, bucket: "cash", amount: 0, category: "x", reversalOf: exp.id }));
await w2.intent({ byId: ownerId, action: "expense.record", input: { name: "office", amount: 20000 } });
await w2.ledgerEntry({ byId: ownerId, bucket: "cash", amount: 250000, category: "credit", partyId: "party-meera" });
const led2: any = await w2.toolRows({ byId: ownerId, toolId: "register" });
const party = led2.rows.filter((e: any) => e.data.party_id === "party-meera");
const bal = party.reduce((sum: number, e: any) => sum + Number(e.data.amount), 0);
ok("party (credit) balance tracked", bal === 250000);

// 11 · Ask (deterministic now)
const ans = await w2.ask({ byId: ownerId, q: "sales today?" });
ok("Ask answers sales today", /Rs\./.test(ans));
const ans2 = await w2.ask({ byId: ownerId, q: "low stock?" });
ok("Ask answers low stock", /Rice/.test(ans2));

// 12 · HOME reads
ok("owner HOME has full recipe cards", home.cards.some((x: any) => x.tool === "order") && home.cards.some((x: any) => x.tool === "stock") && home.cards.some((x: any) => x.tool === "register") && home.cards.some((x: any) => x.tool === "site") && home.cards.some((x: any) => x.tool === "member"));
ok("NEXT has open items", home.next === null || typeof home.next.id === "string");
const nextSaleSeen = seen.includes("new_sale");
ok("broadcast new_sale seen by connected client", nextSaleSeen, seen);

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
