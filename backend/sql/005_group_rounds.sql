-- Старые оценки и совпадения остаются неизменными. Старые раунды закрываем:
-- их исходный состав невозможно достоверно восстановить после выходов гостей.
ALTER TABLE selection_sessions ADD COLUMN IF NOT EXISTS roster jsonb NOT NULL DEFAULT '[]';
ALTER TABLE selection_sessions ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false;
UPDATE selection_sessions SET cancelled=true WHERE roster='[]'::jsonb;
UPDATE rooms SET selection=selection || '{"participants":[],"cancelled":true}'::jsonb,
 revision=revision+1 WHERE selection IS NOT NULL;
CREATE TABLE IF NOT EXISTS participant_connections (
 socket_id text PRIMARY KEY,
 participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS participant_connections_member_idx ON participant_connections(participant_id,expires_at);
