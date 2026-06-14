-- @param {String} $1:userId
SELECT COUNT(*)::int AS total
FROM events e
WHERE e.status = 'published'
  AND e.ends_at > now()
  AND NOT EXISTS (
    SELECT 1 FROM organisations o
    WHERE o.id = e.organisation_id AND o.suspended_at IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.user_id = $1 AND om.organisation_id = e.organisation_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM blocks b
    WHERE b.blocker_user_id = $1
      AND b.blockable_type = 'organisation'
      AND b.blockable_id = e.organisation_id
  )
