-- @param {String} $1:organisationId
-- @param {DateTime} $2:from
-- @param {DateTime} $3:to
SELECT
  TO_CHAR(o.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
  COALESCE(SUM(o.subtotal_minor), 0)::bigint AS revenue_minor,
  COALESCE(SUM(o.items_quantity_total), 0)::int AS tickets,
  COUNT(*)::int AS orders
FROM orders o
JOIN events e ON e.id = o.event_id
WHERE e.organisation_id = $1
  AND o.status = 'paid'
  AND o.paid_at BETWEEN $2 AND $3
GROUP BY day
