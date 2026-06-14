-- @param {String} $1:userId
-- @param {Int} $2:hasCoords
-- @param {Float} $3:latitude
-- @param {Float} $4:longitude
-- @param {Int} $5:hasCity
-- @param {String} $6:city
-- @param {Float} $7:weightInterest
-- @param {Float} $8:weightSubscribed
-- @param {Float} $9:weightGeo
-- @param {Float} $10:weightTime
-- @param {Float} $11:weightRecency
-- @param {Float} $12:timeBonus24h
-- @param {Float} $13:timeBonus7d
-- @param {Float} $14:timeBonus30d
-- @param {Float} $15:recencyBonus7d
-- @param {Float} $16:recencyBonus30d
-- @param {Float} $17:geoDistanceScaleKm
-- @param {Int} $18:limit
-- @param {Int} $19:offset
SELECT
  e.id,
  (
    SELECT COUNT(*)::int
    FROM event_interest ei
    JOIN interest_user iu ON iu.interest_id = ei.interest_id AND iu.user_id = $1
    WHERE ei.event_id = e.id
  ) AS interest_overlap,
  (
    CASE WHEN EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.user_id = $1 AND s.organisation_id = e.organisation_id
    ) THEN 1 ELSE 0 END
  )::int AS is_subscribed,
  (
    $7::float8 * (
      SELECT COUNT(*)
      FROM event_interest ei
      JOIN interest_user iu ON iu.interest_id = ei.interest_id AND iu.user_id = $1
      WHERE ei.event_id = e.id
    )
    + $8::float8 * (
      CASE WHEN EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.user_id = $1 AND s.organisation_id = e.organisation_id
      ) THEN 1 ELSE 0 END
    )
    + $9::float8 * (
      CASE
        WHEN $2 = 1 AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL THEN
          1.0 / (1 + (
            6371 * acos(LEAST(1.0,
              cos(radians($3::float8)) * cos(radians(e.latitude::float8))
              * cos(radians(e.longitude::float8) - radians($4::float8))
              + sin(radians($3::float8)) * sin(radians(e.latitude::float8))
            ))
          ) / $17::float8)
        WHEN $2 = 0 AND $5 = 1 AND e.city = $6 THEN 1.0
        ELSE 0.0
      END
    )
    + $10::float8 * (
      CASE
        WHEN e.starts_at < now() + interval '24 hours' THEN $12::float8
        WHEN e.starts_at < now() + interval '7 days'  THEN $13::float8
        WHEN e.starts_at < now() + interval '30 days' THEN $14::float8
        ELSE 0.2::float8
      END
    )
    + $11::float8 * (
      CASE
        WHEN e.published_at > now() - interval '7 days'  THEN $15::float8
        WHEN e.published_at > now() - interval '30 days' THEN $16::float8
        ELSE 0.0::float8
      END
    )
  )::float8 AS feed_score
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
ORDER BY feed_score DESC, e.starts_at ASC, e.id ASC
LIMIT $18 OFFSET $19
