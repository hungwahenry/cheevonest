-- @param {String} $1:tsquery
-- @param {String} $2:searchableType
-- @param {Int} $3:limit
-- @param {Int} $4:offset
SELECT
  searchable_id,
  ts_rank(fts, to_tsquery('simple', $1))::float8 AS score
FROM search_index
WHERE searchable_type = $2
  AND fts @@ to_tsquery('simple', $1)
ORDER BY score DESC
LIMIT $3 OFFSET $4
