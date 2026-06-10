-- @param {String} $1:eventId
SELECT
  oi.event_ticket_id,
  COALESCE(SUM(oi.subtotal_minor), 0)::bigint AS revenue_minor
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.event_id = $1
  AND o.status = 'paid'
GROUP BY oi.event_ticket_id
