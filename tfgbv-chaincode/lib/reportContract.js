// lib/reportContract.js
'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');
class ReportContract extends Contract {

  async CreateReport(ctx, description, category, victimTokenHash) {
    
    if (!victimTokenHash) {
      throw new Error('victimTokenHash required');
    }
    // Generate anonymous report ID (not linked to identity)
    const txId = ctx.stub.getTxID();
    const timestamp = ctx.stub.getTxTimestamp();
    const reportId = crypto
      .createHash('sha256')
      .update(txId + timestamp.seconds.low)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();

    const report = {
      reportId,
      category,           // e.g. "online_harassment", "image_abuse", "stalking"
      description,        // what happened (no identity info)
      victimTokenHash,    // hash of the victim's private token
      status: 'SUBMITTED',
      createdAt: new Date(timestamp.seconds.low * 1000).toISOString(),
      lastUpdated: new Date(timestamp.seconds.low * 1000).toISOString(),
      assignedTo: null,
      accessLog: [{
        action: 'REPORT_CREATED',
        actor: 'ANONYMOUS',
        timestamp: new Date(timestamp.seconds.low * 1000).toISOString()
      }]
    };
    try {
      await ctx.stub.putState(
        `REPORT_${reportId}`,
        Buffer.from(JSON.stringify(report))
      );
    } catch (err) {
      console.error(report)
      console.error("Error storing report:", err);
      throw new Error('Failed to create report');
    }
    
    // Emit event for case handlers to pick up
    ctx.stub.setEvent('ReportCreated', Buffer.from(JSON.stringify({
      reportId,
      category,
      status: 'SUBMITTED'
      // NO victim identity in event
    })));

    return JSON.stringify({
      reportId,
      message: 'Report submitted anonymously. Save your token to track this case.'
    });
  }

  //  VICTIM CHECKS STATUS USING THEIR PRIVATE TOKEN
  async CheckReportStatus(ctx, reportId, victimToken) {

    const report = await this._getReport(ctx, reportId);

    // Verify token matches without revealing identity
    const tokenHash = crypto
      .createHash('sha256')
      .update(victimToken)
      .digest('hex');

    if (tokenHash !== report.victimTokenHash) {
      throw new Error('Invalid token. Access denied.');
    }

    // SAFE timeline (no actor/org leak)
    const timeline = (report.accessLog || []).map(log => ({
      action: log.action,
      status: log.newStatus || null,
      timestamp: log.timestamp
    }));
    // Return status without sensitive internal details
    return JSON.stringify({
      reportId: report.reportId,
      status: report.status,
      category: report.category,
      createdAt: report.createdAt,
      lastUpdated: report.lastUpdated,
      assignedTo: report.assignedTo ? 'A case handler has been assigned' : 'Pending assignment',
      message: this._getStatusMessage(report.status),
      timeline
    });
  }

  //  CASE HANDLER VIEWS FULL REPORT (Org2 only)
  async ViewReport(ctx, reportId) {

    const mspId = ctx.clientIdentity.getMSPID();
    if (mspId !== 'Org2MSP' && mspId !== 'Org3MSP') {
      throw new Error('Only authorized case handlers can view reports');
    }

    const report = await this._getReport(ctx, reportId);

    // Log access — every view is recorded
    const handlerId = ctx.clientIdentity.getID();
    const timestamp = new Date().toISOString();

    report.accessLog.push({
      action: 'REPORT_VIEWED',
      actor: this._anonymizeHandlerId(handlerId),
      org: mspId,
      timestamp
    });

    await ctx.stub.putState(
      `REPORT_${reportId}`,
      Buffer.from(JSON.stringify(report))
    );

    return JSON.stringify(report);
  }

  //  UPDATE REPORT STATUS
  async UpdateReportStatus(ctx, reportId, newStatus, notes) {

    const mspId = ctx.clientIdentity.getMSPID();
    if (mspId !== 'Org2MSP' && mspId !== 'Org3MSP') {
      throw new Error('Unauthorized');
    }

    const validStatuses = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'EVIDENCE_REQUESTED',
      'REFERRED',
      'CLOSED_RESOLVED',
      'CLOSED_WITHDRAWN'
    ];

    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const report = await this._getReport(ctx, reportId);
    const handlerId = ctx.clientIdentity.getID();
    const timestamp = ctx.stub.getTxTimestamp();
    const ts = new Date(timestamp.seconds.low * 1000).toISOString();

    report.status = newStatus;
    report.lastUpdated = ts;

    report.accessLog.push({
      action: 'STATUS_UPDATED',
      newStatus,
      notes,
      actor: this._anonymizeHandlerId(handlerId),
      org: mspId,
      timestamp: ts
    });

    await ctx.stub.putState(
      `REPORT_${reportId}`,
      Buffer.from(JSON.stringify(report))
    );

    ctx.stub.setEvent('ReportStatusUpdated', Buffer.from(JSON.stringify({
      reportId,
      newStatus,
      timestamp: ts
    })));

    return JSON.stringify({ success: true, reportId, newStatus });
  }

  //  GET ALL REPORTS (case handler dashboard)
  async GetAllReports(ctx) {
    const mspId = ctx.clientIdentity.getMSPID();
    if (mspId !== 'Org2MSP' && mspId !== 'Org3MSP') {
      throw new Error('Unauthorized');
    }

    const iterator = await ctx.stub.getStateByRange('REPORT_', 'REPORT_~');
    const reports = [];

    let result = await iterator.next();
    while (!result.done) {
      const report = JSON.parse(result.value.value.toString());
      // Strip victim token hash before returning list
      delete report.victimTokenHash;
      reports.push(report);
      result = await iterator.next();
    }

    return JSON.stringify(reports);
  }

  //  GET FULL AUDIT LOG OF A REPORT
  async GetReportAuditLog(ctx, reportId) {
    const mspId = ctx.clientIdentity.getMSPID();
    if (mspId !== 'Org2MSP' && mspId !== 'Org3MSP') {
      throw new Error('Unauthorized');
    }

    // Get full blockchain history of this report
    const iterator = await ctx.stub.getHistoryForKey(`REPORT_${reportId}`);
    const history = [];

    let result = await iterator.next();
    while (!result.done) {
      history.push({
        txId: result.value.txId,
        timestamp: result.value.timestamp,
        isDelete: result.value.isDelete,
        data: result.value.isDelete
          ? null
          : JSON.parse(result.value.value.toString())
      });
      result = await iterator.next();
    }

    return JSON.stringify(history);
  }

  // ─── HELPERS ───────────────────────────────────────

  async _getReport(ctx, reportId) {
    const data = await ctx.stub.getState(`REPORT_${reportId}`);
    if (!data || data.length === 0) {
      throw new Error(`Report ${reportId} does not exist`);
    }
    return JSON.parse(data.toString());
  }

  _anonymizeHandlerId(id) {
    // Store only a hash of handler ID to protect their identity too
    return crypto.createHash('sha256').update(id).digest('hex').substring(0, 12);
  }

  _getStatusMessage(status) {
    const messages = {
      'SUBMITTED': 'Your report has been received and is awaiting review.',
      'UNDER_REVIEW': 'A case handler is reviewing your report.',
      'EVIDENCE_REQUESTED': 'Additional evidence has been requested.',
      'REFERRED': 'Your case has been referred to the appropriate authority.',
      'CLOSED_RESOLVED': 'Your case has been resolved.',
      'CLOSED_WITHDRAWN': 'This case has been withdrawn.'
    };
    return messages[status] || 'Status unknown';
  }
}

module.exports = ReportContract;// rebuild Sun Mar 22 15:36:50 +06 2026
