-- Существующие комнаты сохраняются; для старых комнат ведущий — первый оставшийся участник.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS filters jsonb NOT NULL DEFAULT '{"genreIds":[],"yearFrom":null,"yearTo":null,"minRating":null,"maxRuntime":null}';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS selection jsonb;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
UPDATE rooms r SET owner_id = (
  SELECT id FROM participants WHERE room_id=r.id ORDER BY created_at,id LIMIT 1
) WHERE r.owner_id IS NULL;
