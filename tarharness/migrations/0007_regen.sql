-- CONTROL records when the scheduled sweep last re-read each published site, so the
-- regenerate pass throttles without opening every workspace database. A rebuild writes a
-- draft; only the merchant puts a release live.
ALTER TABLE sites ADD COLUMN regen INTEGER NOT NULL DEFAULT 0;
