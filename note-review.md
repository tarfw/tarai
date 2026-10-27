# Note Review — later

## Inbox: unclutter (2026-10-27)

Verdict: mildly overengineered — half the row is never consumed.

Consumed: member, status, title, urgent, due, action, created.
Dead end-to-end: `move`, `tool`, `reach`, `assigned`, `input` (client uses id/title/urgent only). `completeInboxStatement` is dead code; 'done' history written, never read.

Plan when picked up:
1. Trim row to the 7 live fields (5 call sites + `readInbox` + app `InboxRow` type).
2. Delete `completeInboxStatement` (superseded by `settleInbox`).
3. Make rows with an `action` tappable in the inbox sheet (today: dead text).

Keep: stored rows (not derived) — "Pack the new order" must survive refresh and target another member.
