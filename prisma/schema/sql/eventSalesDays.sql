-- @param {String} $1:eventId
SELECT
  TO_CHAR(paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
  COALESCE(SUM(subtotal_minor), 0)::bigint AS revenue_minor,
  COALESCE(SUM(items_quantity_total), 0)::int AS tickets_sold
FROM orders
WHERE event_id = $1
  AND status = 'paid'
  AND paid_at IS NOT NULL
GROUP BY day
