// Live contract test (Rivet Cloud): mirrors tarapp src/lib/tar.ts against the Rivet 3.0 actor.
// Mints a token from /mint, then runs the app's exact call sequence.
import { createClient } from "rivetkit/client";
import type { registry as RegistryType } from "./index.js";

const APP_URL = process.env.RIVET_URL || "https://tars93k.onrivet.dev";
const API_URL = process.env.RIVET_API_URL || "https://tars93k-api.onrivet.dev";

const mintRes = await fetch(`${APP_URL}/mint`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ subject: "tar-phone" }),
});
const mintBody: any = await mintRes.json();
if (!mintBody.token) throw new Error(`mint failed: ${mintRes.status} ${JSON.stringify(mintBody)}`);

const client = createClient<RegistryType>({
  endpoint: API_URL,
  token: mintBody.token,
  namespace: "default",
});

// 1 · onboarding: create business workspace
const slug = Math.random().toString(36).slice(2, 10);
const w = client.workspace.getOrCreate([slug]);
const born: any = await w.createWorkspace({ name: "Aambal Stores", type: "store", ownerName: "Owner" });
console.log("1 createWorkspace ✓  owner:", born.ownerId.slice(0, 8), "| type: store");

// 2 · slice: the HOME canvas payload
const sl: any = await w.slice({ byId: born.ownerId });
console.log("2 slice ✓  cards:", sl.cards.map((c: any) => `${c.tool}(${c.value})`).join(" "), "| next:", sl.next === null ? "none" : sl.next.title);

// 3 · intent: stock + POS sale
const cat: any = await w.intent({ byId: born.ownerId, action: "catalog.item.save",
  input: { name: "Sari", price: 95000, qty: 3 }, key: "c1" });
const sale: any = await w.intent({ byId: born.ownerId, action: "sale.write",
  input: { lines: [{ variant: cat.result.id, quantity: 1 }], method: "cash" }, key: `s-${Date.now()}` });
console.log("3 intent ✓  catalog:", cat.result.id.slice(0, 6), "| sale:", sale.status, sale.paid);

// 4 · sections + forms
const rows: any = await w.toolRows({ byId: born.ownerId, toolId: "stock" });
const forms: any = await w.actionCatalogs({ byId: born.ownerId });
const rec: any = await w.record({ byId: born.ownerId, id: sale.id });
console.log("4 sections ✓  stock rows:", rows.rows.length, "| forms:", forms.actions.length, "| record state:", rec.record.state);

console.log("\nAPP CONTRACT: ALL GREEN");
process.exit(0);
