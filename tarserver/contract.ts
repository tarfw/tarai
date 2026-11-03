// Live contract test: mirrors tarapp src/lib/tar.ts against the deployed actor.
import { createClient } from "rivetkit/client";
import type { registry as RegistryType } from "./index.js";

const APP_URL = "https://tars93k.onrivet.dev";
const API_HOST = "tars93k-api.onrivet.dev";

// 1 · session: mint via the app URL (as the phone does)
const mintRes = await fetch(`${APP_URL}/mint`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ subject: "contract-test" }),
});
const minted: any = await mintRes.json();
if (!minted.token) throw new Error(`mint failed ${mintRes.status}: ${JSON.stringify(minted).slice(0, 200)}`);
console.log("1 /mint ✓  token:", String(minted.token).slice(0, 18) + "…");

// 2 · client with URL-auth token
const client = createClient<RegistryType>(`https://default:${encodeURIComponent(minted.token)}@${API_HOST}`);

// 3 · onboarding: create business + personal workspaces
const slug = Math.random().toString(36).slice(2, 10);
const w = client.workspace.getOrCreate([slug]);
const born: any = await w.createWorkspace({ name: "Aambal Stores", type: "store", ownerName: "Owner" });
console.log("2 createWorkspace ✓  owner:", born.ownerId.slice(0, 8), "| type: store");

// 4 · slice: the HOME canvas payload
const sl: any = await w.slice({ byId: born.ownerId });
console.log("3 slice ✓  cards:", sl.cards.map((c: any) => `${c.tool}(${c.value})`).join(" "), "| next:", sl.next === null ? "none" : sl.next.title);

// 5 · intent: stock + POS sale
const cat: any = await w.intent({ byId: born.ownerId, action: "catalog.item.save",
  input: { name: "Sari", price: 95000, qty: 3 }, key: "c1" });
const sale: any = await w.intent({ byId: born.ownerId, action: "sale.write",
  input: { lines: [{ variant: cat.result.id, quantity: 1 }], method: "cash" }, key: `s-${Date.now()}` });
console.log("4 intent ✓  catalog:", cat.result.id.slice(0, 6), "| sale:", sale.status, sale.paid);

// 6 · sections + forms
const rows: any = await w.toolRows({ byId: born.ownerId, toolId: "stock" });
const forms: any = await w.actionCatalogs({ byId: born.ownerId });
const rec: any = await w.record({ byId: born.ownerId, id: sale.id });
console.log("5 sections ✓  stock rows:", rows.rows.length, "| forms:", forms.actions.length, "| record state:", rec.record.state);

console.log("\nAPP CONTRACT: ALL GREEN");
process.exit(0);
