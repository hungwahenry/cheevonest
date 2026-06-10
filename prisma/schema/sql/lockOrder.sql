-- @param {String} $1:orderId
SELECT id FROM orders WHERE id = $1 FOR UPDATE
