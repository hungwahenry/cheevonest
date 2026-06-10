-- @param {String} $1:organisationId
SELECT id FROM payouts WHERE organisation_id = $1 AND status IN ('requested', 'approved', 'processing') FOR UPDATE
