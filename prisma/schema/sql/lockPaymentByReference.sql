-- @param {String} $1:reference
SELECT id FROM payments WHERE reference = $1 FOR UPDATE
