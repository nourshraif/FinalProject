-- Verify notifications table exists and inspect row counts (run with psql or your SQL client).
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'notifications'
) AS notifications_table_exists;

SELECT COUNT(*) AS total_notifications FROM notifications;

SELECT user_id, type, is_read, title, created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 20;
