import { createClient } from "rivetkit/client";
import type { registry as R } from "./index.js";
const c = createClient<R>(`https://default:${process.env.GT}@tars93k-api.onrivet.dev`);
const w = c.workspace.getOrCreate(["gtest-" + Date.now()]);
const born: any = await w.createWorkspace({ name: "G", type: "store", ownerName: "O" });
const sl: any = await w.slice({ byId: born.ownerId });
console.log("GRANTS OK — cards:", sl.cards.map((x: any) => x.tool).join(","));
