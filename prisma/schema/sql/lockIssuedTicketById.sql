-- @param {String} $1:ticketId
SELECT id FROM issued_tickets WHERE id = $1 FOR UPDATE
