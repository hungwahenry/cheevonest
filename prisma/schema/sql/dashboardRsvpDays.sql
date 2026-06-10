-- @param {String} $1:organisationId
-- @param {DateTime} $2:from
-- @param {DateTime} $3:to
SELECT
  TO_CHAR(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
  COUNT(*)::int AS rsvps
FROM event_rsvps r
JOIN events e ON e.id = r.event_id
WHERE e.organisation_id = $1
  AND r.created_at BETWEEN $2 AND $3
GROUP BY day
