-- The closed-phone bell: one row per device token, refreshed on register.
CREATE TABLE IF NOT EXISTS push_tokens (
  user TEXT NOT NULL,
  token TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_tokens_user ON push_tokens(user);
