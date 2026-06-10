-- @param {String} $1:providerReference
SELECT id FROM payouts WHERE provider_reference = $1 FOR UPDATE
