'use strict';
const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class EvidenceContract extends Contract {

  async RegisterEvidence(ctx, reportId, fileHash, cid, fileName, fileType, description) {

    const timestamp = ctx.stub.getTxTimestamp();
    const txId = ctx.stub.getTxID();

    const evidenceId = `EVD_${reportId}_${txId.substring(0, 8).toUpperCase()}`;

    const evidence = {
      evidenceId,
      reportId,
      fileHash,
      cid,
      fileName,
      fileType,
      description,
      submittedAt: new Date(timestamp.seconds.low * 1000).toISOString(),
      txId,
      verified: false,
      verifiedBy: null,
      verifiedAt: null,
      accessLog: [{
        action: 'EVIDENCE_REGISTERED',
        actor: 'ANONYMOUS',
        timestamp: new Date(timestamp.seconds.low * 1000).toISOString()
      }]
    };
    
    await ctx.stub.putState(
      evidenceId,
      Buffer.from(JSON.stringify(evidence))
    );

    ctx.stub.setEvent(
      'EvidenceRegistered',
      Buffer.from(JSON.stringify({
        evidenceId,
        reportId,
        cid
      }))
    );

    return JSON.stringify({
      evidenceId,
      message: 'Evidence registered on blockchain'
    });
  }
  async GetEvidenceByReport(ctx, reportId) {

    const mspId = ctx.clientIdentity.getMSPID();

    if (mspId !== 'Org2MSP' && mspId !== 'Org3MSP') {
      throw new Error('Unauthorized');
    }

    const iterator = await ctx.stub.getStateByRange(
      `EVD_${reportId}_`,
      `EVD_${reportId}_~`
    );

    const results = [];

    let result = await iterator.next();

    while (!result.done) {

      const ev = JSON.parse(result.value.value.toString());

      // log access
      ev.accessLog = ev.accessLog || [];

      const timex = ctx.stub.getTxTimestamp();
      const timestamp = new Date(timex.seconds.low * 1000).toISOString();

      ev.accessLog.push({
        action: 'EVIDENCE_ACCESSED',
        actor: crypto.createHash('sha256')
          .update(ctx.clientIdentity.getID())
          .digest('hex')
          .substring(0, 12),
        org: mspId,
        timestamp
      });

      // ✅ FIXED: use correct key
      await ctx.stub.putState(result.value.key, Buffer.from(JSON.stringify(ev)));

      results.push(ev);

      result = await iterator.next();
    }

    return JSON.stringify(results);
  }

  async VerifyEvidence(ctx, evidenceId, fileHashToCheck) {
    const data = await ctx.stub.getState(evidenceId);
    if (!data || data.length === 0) throw new Error(`Evidence ${evidenceId} not found`);
    const evidence = JSON.parse(data.toString());
    return JSON.stringify({
      evidenceId,
      isIntact: evidence.fileHash === fileHashToCheck,
      originalHash: evidence.fileHash,
      cid: evidence.cid,
      submittedAt: evidence.submittedAt,
      message: evidence.fileHash === fileHashToCheck
        ? 'Evidence is intact and unmodified'
        : 'Evidence has been tampered with'
    });
  }

  async MarkEvidenceVerified(ctx, evidenceId, notes) {
    const mspId = ctx.clientIdentity.getMSPID();
    if (mspId !== 'Org3MSP') throw new Error('Only Org3 can verify evidence');
    const data = await ctx.stub.getState(evidenceId);
    if (!data || data.length === 0) throw new Error(`Evidence ${evidenceId} not found`);
    const evidence = JSON.parse(data.toString());
    const handlerId = ctx.clientIdentity.getID();

    const timex = ctx.stub.getTxTimestamp();
    const timestamp = new Date(timex.seconds.low * 1000).toISOString();
    evidence.verified = true;
    evidence.verifiedBy = crypto.createHash('sha256').update(handlerId).digest('hex').substring(0, 12);
    evidence.verifiedAt = timestamp;
    evidence.notes = notes;
    evidence.accessLog.push({ action: 'EVIDENCE_VERIFIED', org: mspId, timestamp });
    await ctx.stub.putState(evidenceId, Buffer.from(JSON.stringify(evidence)));
    return JSON.stringify({ success: true, evidenceId, verifiedAt: timestamp });
  }
}

module.exports = EvidenceContract;