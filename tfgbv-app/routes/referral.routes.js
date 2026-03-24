'use strict';

const express = require('express');
const router = express.Router();
const { evaluateTransaction, submitTransaction } = require('../fabric/gateway');
const { requireOrg } = require('../middleware/auth.middleware');

//  POST /api/referrals
// NGO creates a referral to law enforcement
router.post('/', requireOrg('Org2MSP'), async (req, res) => {
  try {
    console.log(req.body);
    const { reportId, reason, urgencyLevel } = req.body;

    if (!reportId || !reason || !urgencyLevel) {
      return res.status(400).json({
        error: 'reportId, targetOrg, reason and urgencyLevel are required'
      });
    }

    const result = await submitTransaction(
      req.org,
      'ReferralContract:CreateReferral',
      reportId,
      'Org3MSP', // always refer to law enforcement
      reason,
      urgencyLevel
    );

    res.status(201).json({ success: true, data: result });

  } catch (err) {
    res.status(500).json({ error: err.details });
    console.error('Error creating referral:', err.details);
  }
});

//  PATCH /api/referrals/:referralId/respond
// Law enforcement accepts or rejects referral
router.patch('/:referralId/respond', requireOrg('Org3MSP'), async (req, res) => {
  try {
    const { response, notes } = req.body;

    const result = await submitTransaction(
      req.org,
      'ReferralContract:RespondToReferral',
      req.params.referralId,
      response,
      notes || ''
    );

    res.json({ success: true, data: result });

  } catch (err) {
    res.status(500).json({ error: err.details });
    console.error('Error responding to referral:', err.details);
  }
});
//  Get all referrals
router.get('/', requireOrg('Org2MSP', 'Org3MSP'), async (req, res) => {
  try {
    const result = await evaluateTransaction(
      req.org,
      'ReferralContract:GetAllReferrals'
    );
    console.log(result);
    let data;

    try {
      data = typeof result === 'string'
        ? JSON.parse(result)
        : result;
    } catch {
      data = result;
    }

    res.json(data);
    // res.json(JSON.parse(result.toString()));
  } catch (err) {
    res.status(500).json({ error: err.details });
    console.error('Error fetching referrals:', err.details);
  }
});

module.exports = router;