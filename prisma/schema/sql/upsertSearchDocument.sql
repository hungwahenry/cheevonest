-- @param {String} $1:searchableType
-- @param {String} $2:searchableId
-- @param {String} $3:weightA
-- @param {String} $4:weightB
-- @param {String} $5:weightC
INSERT INTO search_index (searchable_type, searchable_id, fts, created_at, updated_at)
VALUES (
  $1,
  $2,
  setweight(to_tsvector('simple', $3), 'A') ||
  setweight(to_tsvector('simple', $4), 'B') ||
  setweight(to_tsvector('simple', $5), 'C'),
  NOW(),
  NOW()
)
ON CONFLICT (searchable_type, searchable_id)
DO UPDATE SET fts = EXCLUDED.fts, updated_at = NOW()
