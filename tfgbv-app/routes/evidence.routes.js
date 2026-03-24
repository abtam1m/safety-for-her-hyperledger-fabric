'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { submitTransaction, evaluateTransaction } = require('../fabric/gateway');
const { requireOrg, authenticate } = require('../middleware/auth.middleware');
const { uploadToPinata, getFromIPFS } = require('../services/pinata');

// Store file in memory (not disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5* 1024 * 1024 } // 10MB max
});

//  POST /api/evidence/upload
// Upload file → Pinata → register hash + CID on chain
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { reportId, description } = req.body;
    if (!reportId) return res.status(400).json({ error: 'reportId is required' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;

    // 1. Generate SHA-256 hash of file
    const fileHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    // 2. Upload to Pinata (IPFS)
    const pinataResult = await uploadToPinata(fileBuffer, fileName, {
      reportId,
      fileHash,
      uploadedAt: new Date().toISOString()
    });

    // 3. Register on blockchain
    const result = await submitTransaction(
      'Org1MSP',
      'EvidenceContract:RegisterEvidence',
      reportId,
      fileHash,
      pinataResult.cid,
      fileName,
      fileType,
      description || ''
    );

    res.status(201).json({
      success: true,
      data: {
        ...result,
        fileHash,
        cid: pinataResult.cid,
        
        fileName,
        fileType,
      }
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

//  GET /api/evidence/report/:reportId
// Get all evidence for a report (Org2/Org3 only)
router.get('/report/:reportId', requireOrg('Org2MSP', 'Org3MSP'), async (req, res) => {
  try {
    const result = await evaluateTransaction(
      req.org,
      'GetEvidenceByReport',
      req.params.reportId
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//  GET /api/evidence/retrieve/:cid
// Retrieve actual file from IPFS (Org2/Org3 only)
router.get('/retrieve/:cid', requireOrg('Org2MSP', 'Org3MSP'), async (req, res) => {
  try {
    const { data, contentType } = await getFromIPFS(req.params.cid);
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `inline`);
    res.send(Buffer.from(data));
  } catch (err) {
    res.status(500).json({ error: 'Could not retrieve file from IPFS: ' + err.message });
  }
});

//  POST /api/evidence/verify
router.post('/verify', async (req, res) => {
  try {
    const { evidenceId, fileHash } = req.body;
    const result = await evaluateTransaction('Org1MSP', 'VerifyEvidence', evidenceId, fileHash);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//  PATCH /api/evidence/:evidenceId/verify
router.patch('/:evidenceId/verify', requireOrg('Org3MSP'), async (req, res) => {
  try {
    const result = await submitTransaction(
      req.org,
      'MarkEvidenceVerified',
      req.params.evidenceId,
      req.body.notes || ''
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;