// lib/referralContract.js
'use strict';

const { Contract } = require('fabric-contract-api');

class ReferralContract extends Contract {

    //  CREATE REFERRAL (NGO refers case to authority)
    async CreateReferral(ctx, reportId, targetOrg, reason, urgencyLevel) {

        const mspId = ctx.clientIdentity.getMSPID();
        if (mspId !== 'Org2MSP') {
            throw new Error('Only case handlers (Org2) can create referrals');
        }

        const validUrgency = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        if (!validUrgency.includes(urgencyLevel)) {
            throw new Error(`Urgency must be: ${validUrgency.join(', ')}`);
        }

        const txId = ctx.stub.getTxID();
        const timestamp = ctx.stub.getTxTimestamp();
        const referralId = `REF_${reportId}_${txId.substring(0, 8).toUpperCase()}`;

        const referral = {
            referralId,
            reportId,
            fromOrg: mspId,
            targetOrg,          // "Org3MSP" = law enforcement
            reason,
            urgencyLevel,
            status: 'PENDING',
            createdAt: new Date(timestamp.seconds.low * 1000).toISOString(),
            acceptedAt: null,
            resolvedAt: null,
            notes: []
        };

        await ctx.stub.putState(referralId, Buffer.from(JSON.stringify(referral)));

        ctx.stub.setEvent('ReferralCreated', Buffer.from(JSON.stringify({
            referralId,
            reportId,
            urgencyLevel,
            targetOrg
        })));

        return JSON.stringify({ referralId, message: 'Referral created successfully' });
    }

    //  ACCEPT / REJECT REFERRAL
    async RespondToReferral(ctx, referralId, response, notes) {

        const mspId = ctx.clientIdentity.getMSPID();
        if (mspId !== 'Org3MSP') {
            throw new Error('Only legal authority (Org3) can respond to referrals');
        }

        if (!['ACCEPTED', 'REJECTED'].includes(response)) {
            throw new Error('Response must be ACCEPTED or REJECTED');
        }

        const data = await ctx.stub.getState(referralId);
        if (!data || data.length === 0) {
            throw new Error(`Referral ${referralId} not found`);
        }

        const referral = JSON.parse(data.toString());

        const timex = ctx.stub.getTxTimestamp();
        const timestamp = new Date(timex.seconds.low * 1000).toISOString();

        referral.status = response;
        referral.acceptedAt = response === 'ACCEPTED' ? timestamp : null;
        referral.notes.push({ by: mspId, note: notes, timestamp });

        await ctx.stub.putState(referralId, Buffer.from(JSON.stringify(referral)));

        ctx.stub.setEvent('ReferralResponded', Buffer.from(JSON.stringify({
            referralId,
            reportId: referral.reportId,
            response,
            timestamp
        })));

        return JSON.stringify({ success: true, referralId, status: response });
    }
    async GetAllReferrals(ctx) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const results = [];

        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                results.push(JSON.parse(res.value.value.toString()));
            }
            if (res.done) break;
        }

        return results.filter(r => r.referralId);
    }
}

module.exports = ReferralContract;