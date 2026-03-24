'use strict';

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const crypto   = require('crypto');
const { submitTransaction, evaluateTransaction } = require('../fabric/gateway');
const { requireOrg, authenticate }               = require('../middleware/auth.middleware');
const { uploadToPinata }                         = require('../services/pinata');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

//  POST /api/reports
router.post('/', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    const { description, category } = req.body;

    if (!description || !category) {
      return res.status(400).json({ error: 'description and category are required' });
    }

    // 1. Create report on chain
    const reportResult = JSON.parse(
      await submitTransaction('Org1MSP', 'CreateReport', description, category)
    );
    const reportId = reportResult.reportId;

    
    // const victimToken = reportResult.victimToken;

    // 2. Upload each file to Pinata + register on chain
    const evidenceResults = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileHash = crypto
          .createHash('sha256')
          .update(file.buffer)
          .digest('hex');

        const pinataResult = await uploadToPinata(file.buffer, file.originalname, {
          reportId,
          fileHash,
          uploadedAt: new Date().toISOString()
        });
        console.log("RegisterEvidence args:", {
          reportId,
          fileHash,
          cid: pinataResult.cid,
          fileName: file.originalname,
          fileType: file.mimetype
        });
        const evResult = await submitTransaction(
          'Org1MSP',
          'EvidenceContract:RegisterEvidence',
          reportId,
          fileHash,
          pinataResult.cid,
          file.originalname,
          file.mimetype,
          ''
        );

        evidenceResults.push({
          evidenceId: evResult.evidenceId,
          fileName:   file.originalname,
          fileHash,
          cid:        pinataResult.cid
          
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        reportId,
        
        evidenceCount: evidenceResults.length,
        evidence:      evidenceResults,
        message: 'Report and evidence submitted successfully'
      }
    });

  } catch (err) {
    console.error('Report submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

//  GET /api/reports/status/:reportId
router.get('/status/:reportId', async (req, res) => {
  try {
    const { victimToken } = req.query;
    if (!victimToken) return res.status(400).json({ error: 'victimToken is required' });

    const result = await evaluateTransaction(
      'Org1MSP',
      'CheckReportStatus',
      req.params.reportId,
      victimToken
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

//  GET /api/reports
router.get('/', ...requireOrg('Org2MSP', 'Org3MSP'), async (req, res) => {
  try {
    const result = await evaluateTransaction(
      req.org,
      'ReportContract:GetAllReports' 
    );

    res.json({
      success: true,
      data: result // now proper JSON
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//  GET /api/reports/:reportId
router.get('/:reportId', requireOrg('Org2MSP', 'Org3MSP'), async (req, res) => {
  try {
    const result = await evaluateTransaction(req.org, 'ViewReport', req.params.reportId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//  PATCH /api/reports/:reportId/status
router.patch('/:reportId/status', ...requireOrg('Org2MSP', 'Org3MSP'), async (req, res) => {
  try {
    console.log('PATCH body:', req.body);
    console.log('PATCH params:', req.params);
    console.log('PATCH org:', req.org);

    const status = req.body?.status;
    const notes = req.body?.notes || '';

    console.log('status:', status, 'notes:', notes, 'reportId:', req.params.reportId);

    if (!status) return res.status(400).json({ error: 'status is required' });

    const result = await submitTransaction(
      req.org,
      'ReportContract:UpdateReportStatus',
      req.params.reportId,
      status,
      notes
    );
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Full error:', err);
    res.status(500).json({ error: err.message });
  }
});

//  GET /api/reports/:reportId/audit
router.get('/:reportId/audit', requireOrg('Org2MSP', 'Org3MSP'), async (req, res) => {
  try {
    const result = await evaluateTransaction(
      req.org,
      'GetReportAuditLog',
      req.params.reportId
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
