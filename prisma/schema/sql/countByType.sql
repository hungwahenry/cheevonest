-- @param {String} $1:tsquery
-- @param {String} $2:searchableType
SELECT COUNT(*)::int AS total
FROM search_index
WHERE searchable_type = $2
  AND fts @@ to_tsquery('simple', $1)
