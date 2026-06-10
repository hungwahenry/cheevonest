-- @param {String} $1:eventId
SELECT
  p.city,
  COUNT(DISTINCT o.user_id)::int AS buyers_count
FROM orders o
JOIN profiles p ON p.user_id = o.user_id
WHERE o.event_id = $1
  AND o.status = 'paid'
  AND p.city IS NOT NULL
  AND p.city != ''
GROUP BY p.city
ORDER BY buyers_count DESC
LIMIT 5
