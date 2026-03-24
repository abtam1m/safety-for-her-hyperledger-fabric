'use strict';

const grpc = require('@grpc/grpc-js');
const { credentials } = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Build a connection for a specific org
async function buildConnection(org) {
  const walletService = require('../services/wallet.service');

  const configs = {
    Org1MSP: { peerEndpoint: 'localhost:7051', peerName: 'peer0.org1.tfgbv.com', tlsCert: process.env.ORG1_TLS_CERT },
    Org2MSP: { peerEndpoint: 'localhost:9051', peerName: 'peer0.org2.tfgbv.com', tlsCert: process.env.ORG2_TLS_CERT },
    Org3MSP: { peerEndpoint: 'localhost:11051', peerName: 'peer0.org3.tfgbv.com', tlsCert: process.env.ORG3_TLS_CERT },
  };

  const config = configs[org];
  if (!config) throw new Error(`Unknown org: ${org}`);

  // Get CA-issued identity from wallet
  const userLabel = org === 'Org1MSP' ? 'victim' : org === 'Org2MSP' ? 'handler' : 'authority';
  const adminLabel = org === 'Org1MSP' ? 'org1-admin' : org === 'Org2MSP' ? 'org2-admin' : 'org3-admin';

  let identity = await walletService.getIdentity(userLabel);
  if (!identity) identity = await walletService.getIdentity(adminLabel);
  if (!identity) throw new Error(`No identity found for ${org}`);

  const tlsCert = fs.readFileSync(config.tlsCert);
  const cert = Buffer.from(identity.credentials.certificate, 'utf8');
  const privateKey = crypto.createPrivateKey(identity.credentials.privateKey);

  const client = new grpc.Client(
    config.peerEndpoint,
    grpc.credentials.createSsl(tlsCert),
    { 'grpc.ssl_target_name_override': config.peerName }
  );

  const gateway = connect({
    client,
    identity: {
      mspId: org,
      credentials: cert,
    },
    signer: signers.newPrivateKeySigner(privateKey),
    hash: hash.sha256,
  });

  const network = gateway.getNetwork(process.env.CHANNEL_NAME);
  const contract = network.getContract(process.env.CHAINCODE_NAME);

  return { gateway, contract };
}
// async function buildConnection(org) {
//   const walletService = require('../services/wallet.service');
//   const configs = {
//     Org1MSP: { peerEndpoint: 'localhost:7051', peerName: 'peer0.org1.tfgbv.com', tlsCert: process.env.ORG1_TLS_CERT },
//     Org2MSP: { peerEndpoint: 'localhost:9051', peerName: 'peer0.org2.tfgbv.com', tlsCert: process.env.ORG2_TLS_CERT },
//     Org3MSP: { peerEndpoint: 'localhost:11051', peerName: 'peer0.org3.tfgbv.com', tlsCert: process.env.ORG3_TLS_CERT },
//   };

//   const config = configs[org];
//   if (!config) throw new Error(`Unknown org: ${org}`);

//   // Use org user identity instead of admin for transactions
//   // Try: handler for Org2, authority for Org3, victim for Org1
//   const userLabel = org === 'Org1MSP' ? 'victim' : org === 'Org2MSP' ? 'handler' : 'authority';
//   const adminLabel = org === 'Org1MSP' ? 'org1-admin' : org === 'Org2MSP' ? 'org2-admin' : 'org3-admin';

//   // Try user identity first, fall back to admin
//   let identity = await walletService.getIdentity(userLabel);
//   if (!identity) {
//     identity = await walletService.getIdentity(adminLabel);
//   }

//   if (!identity) throw new Error(`No identity found for ${org}`);

//   const tlsCert = fs.readFileSync(config.tlsCert);
//   const client = new grpc.Client(
//     config.peerEndpoint,
//     grpc.credentials.createSsl(tlsCert),
//     { 'grpc.ssl_target_name_override': config.peerName }
//   );

//   const gateway = connect({
//     client,
//     identity: {
//       mspId: org,
//       credentials: Buffer.from(identity.credentials.certificate, 'utf8'),
//     },
//     signer: signers.newPrivateKeySigner(
//       crypto.createPrivateKey(identity.credentials.privateKey)
//     ),
//     hash: hash.sha256,
//   });

//   const network = gateway.getNetwork(process.env.CHANNEL_NAME);
//   const contract = network.getContract(process.env.CHAINCODE_NAME);

//   return { gateway, contract };
// }

// Submit a transaction (WRITE to ledger)
async function submitTransaction(org, fnName, ...args) {
  const { gateway, contract } = await buildConnection(org);
  // try {
  //   // Use newProposal instead of submitTransaction to avoid policy parsing issues
  //   const proposal = await contract.newProposal(fnName, { arguments: args.map(String) });
  //   const endorsed = await proposal.endorse();
  //   const result = await endorsed.submit();

  //   console.log(`Transaction ${fnName} with args ${args} submitted by ${org}`);

  //   if (!result || result.length === 0) return {};

  //   const str = Buffer.from(result).toString('utf8');

  //   if (/^[\d,\s]+$/.test(str)) {
  //     const bytes = str.split(',').map(Number);
  //     return JSON.parse(Buffer.from(bytes).toString('utf8'));
  //   }

  //   try { return JSON.parse(str); } catch { return str; }

  // } finally {
  //   gateway.close();
  // }
  try {
    const resultBuffer = await contract.submitTransaction(fnName, ...args);

    console.log(`Transaction ${fnName} with args ${args} submitted by ${org}`);

    //chaincode returns raw  raw byte array, convert to JSON
    return Buffer.from(resultBuffer).toString('utf8');
  } finally {
    gateway.close();
  }
}

// Evaluate a transaction (READ from ledger — no consensus needed)
async function evaluateTransaction(org, fnName, ...args) {
  const { gateway, contract } = await buildConnection(org);
  try {
    const resultBuffer = await contract.evaluateTransaction(fnName, ...args);

    const resultString = Buffer.from(resultBuffer).toString('utf8');

    try {
      return JSON.parse(resultString); //  convert to object
    } catch {
      return resultString; // fallback if not JSON
    }

  } finally {
    gateway.close();
  }
}

module.exports = { submitTransaction, evaluateTransaction };