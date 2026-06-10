-- @param {String} $1:code
SELECT id FROM issued_tickets WHERE code = $1 FOR UPDATE
