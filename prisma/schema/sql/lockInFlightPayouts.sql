-- @param {String} $1:organisationId
SELECT id FROM payouts WHERE organisation_id = $1 AND status IN ('requested', 'pending_review', 'approved', 'processing') FOR UPDATE
