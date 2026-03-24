'use strict';

const ReportContract = require('./lib/reportContract');
const EvidenceContract = require('./lib/evidenceContract');
const ReferralContract = require('./lib/referralContract');

module.exports.contracts = [
    ReportContract,
    EvidenceContract,
    ReferralContract
];