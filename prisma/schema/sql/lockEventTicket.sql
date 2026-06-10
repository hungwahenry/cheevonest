-- @param {String} $1:ticketId
-- @param {String} $2:eventId
SELECT id FROM event_tickets WHERE id = $1 AND event_id = $2 FOR UPDATE
