-- В парной версии после выхода ведущего оставался его удалённый ID.
-- Восстанавливаем владельца только там, где прежнего участника уже нет.
UPDATE rooms r SET owner_id=(SELECT p.id FROM participants p WHERE p.room_id=r.id ORDER BY p.created_at,p.id LIMIT 1), revision=revision+1
WHERE owner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM participants p WHERE p.id=r.owner_id AND p.room_id=r.id);
