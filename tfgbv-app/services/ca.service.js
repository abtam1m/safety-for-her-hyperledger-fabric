'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
const wallet = require('./wallet.service');

const NETWORK_DIR = process.env.NETWORK_DIR ||
  path.join(__dirname, '../../tfgbv-network');

const CA_CONFIGS = {
  Org1MSP: {
    caName: 'ca-org1',
    caUrl: 'https://localhost:8054',
    tlsCert: path.join(NETWORK_DIR, 'fabric-ca/org1/ca-cert.pem'),
    adminId: 'org1-admin',
    adminEnrollId: 'org-admin',
    adminEnrollSecret: 'orgadminpw',
    bootstrapMSP: path.join(NETWORK_DIR, 'organizations/peerOrganizations/org1.tfgbv.com/users/Admin@org1.tfgbv.com/msp/bootstrap'),
  },
  Org2MSP: {
    caName: 'ca-org2',
    caUrl: 'https://localhost:9054',
    tlsCert: path.join(NETWORK_DIR, 'fabric-ca/org2/ca-cert.pem'),
    adminId: 'org2-admin',
    adminEnrollId: 'org-admin',
    adminEnrollSecret: 'orgadminpw',
    bootstrapMSP: path.join(NETWORK_DIR, 'organizations/peerOrganizations/org2.tfgbv.com/users/Admin@org2.tfgbv.com/msp/bootstrap'),
  },
  Org3MSP: {
    caName: 'ca-org3',
    caUrl: 'https://localhost:10054',
    tlsCert: path.join(NETWORK_DIR, 'fabric-ca/org3/ca-cert.pem'),
    adminId: 'org3-admin',
    adminEnrollId: 'org-admin',
    adminEnrollSecret: 'orgadminpw',
    bootstrapMSP: path.join(NETWORK_DIR, 'organizations/peerOrganizations/org3.tfgbv.com/users/Admin@org3.tfgbv.com/msp/bootstrap'),
  },
};

// ── Get axios instance ─────────────────────────────────
function getClient(mspId) {
  const config = CA_CONFIGS[mspId];
  const caCert = fs.readFileSync(config.tlsCert);
  return {
    client: axios.create({
      baseURL: `${config.caUrl}/api/v1`,
      httpsAgent: new https.Agent({ ca: caCert, rejectUnauthorized: false }),
    }),
    config,
  };
}

// ── Build Fabric CA token ──────────────────────────────
// Token format: base64(cert).base64(sign(base64(body)))
function buildToken(certificate, privateKeyPem, body) {
  console.log('buildToken cert first 30:', certificate.substring(0, 30));
  console.log('buildToken cert has PEM header:', certificate.includes('BEGIN'));
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const b64body = Buffer.from(bodyStr).toString('base64');

  // Extract raw base64 from PEM — remove all non-base64 characters
  const certDer = certificate
    .split('\n')
    .filter(line => !line.startsWith('-----') && line.trim().length > 0)
    .join('');

  console.log('certDer length:', certDer.length);
  console.log('certDer first 10:', certDer.substring(0, 10));

  const privKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign('sha256', Buffer.from(b64body), privKey);
  const b64sig = signature.toString('base64');

  return `${certDer}.${b64sig}`;
}

// ── Enroll (Basic Auth) ────────────────────────────────
async function enroll(mspId, enrollmentID, enrollmentSecret, role, displayName) {
  const { client, config } = getClient(mspId);

  // Generate key pair
  const { privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // Generate CSR using openssl
  const { execSync } = require('child_process');

  // Use unique temp filenames to avoid conflicts
  const timestamp = Date.now();
  const tmpKey = `/tmp/ca-${timestamp}-key.pem`;
  const tmpCSR = `/tmp/ca-${timestamp}-csr.pem`;

  try {
    // Write key file synchronously and verify it exists
    fs.writeFileSync(tmpKey, privateKey, { mode: 0o600 });

    // Verify file was written
    if (!fs.existsSync(tmpKey)) {
      throw new Error(`Failed to write key file: ${tmpKey}`);
    }

    // Generate CSR
    execSync(
      `openssl req -new -key "${tmpKey}" -out "${tmpCSR}" -subj "/CN=${enrollmentID}"`,
      { stdio: 'pipe' }
    );

    const csr = fs.readFileSync(tmpCSR, 'utf8');

    // Basic auth for enroll
    const basicAuth = Buffer.from(`${enrollmentID}:${enrollmentSecret}`).toString('base64');

    const response = await client.post('/enroll', {
      certificate_request: csr,
    }, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      params: { caname: config.caName },
    });

    if (!response.data.result?.Cert) {
      throw new Error('Enroll failed: ' + JSON.stringify(response.data.errors));
    }

    const certificate = Buffer.from(
      response.data.result.Cert, 'base64'
    ).toString('utf8');

    const identity = {
      mspId,
      type: 'X.509',
      role: role || 'client',
      displayName: displayName || enrollmentID,
      credentials: { certificate, privateKey },
    };

    await wallet.putIdentity(enrollmentID, identity);
    console.log(`${enrollmentID} enrolled `);
    return identity;

  } finally {
    // Always cleanup temp files
    if (fs.existsSync(tmpKey)) fs.unlinkSync(tmpKey);
    if (fs.existsSync(tmpCSR)) fs.unlinkSync(tmpCSR);
  }
}
// ── Register (Token Auth) ──────────────────────────────
async function register(mspId, adminId, username, password, role, displayName) {
  const { execSync } = require('child_process');
  const config = CA_CONFIGS[mspId];

  const fabricBin = '/home/tamim/fabric-dev/fabric-samples/bin';
  const bootstrapMSP = config.bootstrapMSP;

  const cmd = [
    `${fabricBin}/fabric-ca-client register`,
    `--caname ${config.caName}`,
    `--id.name "${username}"`,
    `--id.secret "${password}"`,
    `--id.type client`,
    `--tls.certfiles ${config.tlsCert}`,
    `--mspdir ${bootstrapMSP}`,
    `--url https://localhost:${config.caUrl.split(':')[2]}`,
    `--id.attrs "role=${role}:ecert,displayName=${displayName}:ecert"`,
  ].join(' ');

  try {
    const output = execSync(cmd, {
      env: { ...process.env, FABRIC_CA_CLIENT_HOME: '/tmp' },
      stdio: 'pipe'
    }).toString();
    console.log(`${username} registered in CA `);
    return password;
  } catch (err) {
    const errMsg = err.stderr?.toString() || err.message;
    // If already registered that's fine
    if (errMsg.includes('already exists') || errMsg.includes('Identity already exists')) {
      console.log(`${username} already registered in CA`);
      return password;
    }
    throw new Error(errMsg);
  }
}
// ── Enroll admin ───────────────────────────────────────
async function enrollAdmin(mspId) {
  const config = CA_CONFIGS[mspId];
  const adminLabel = config.adminId;

  if (await wallet.identityExists(adminLabel)) {
    console.log(`Admin ${adminLabel} already in wallet`);
    return wallet.getIdentity(adminLabel);
  }

  // Enroll using the org-admin identity (has registrar attributes)
  // org-admin was registered during enrollIdentities.sh with admin type
  const identity = await enroll(
    mspId,
    'org-admin',
    'orgadminpw',
    'admin',
    'Org Admin'
  );

  await wallet.putIdentity(adminLabel, identity);
  await wallet.removeIdentity('org-admin');
  console.log(`Admin ${adminLabel} saved to wallet `);
  return identity;
}

// ── Register + enroll new user ─────────────────────────
async function registerUser({ username, password, mspId, role, displayName }) {
  const config = CA_CONFIGS[mspId];
  await register(mspId, config.adminId, username, password, role, displayName);
  return enroll(mspId, username, password, role, displayName);
}

// ── Enroll existing user ───────────────────────────────
async function enrollUser({ username, password, mspId, role, displayName }) {
  return enroll(mspId, username, password, role, displayName);
}

// ── Revoke user ────────────────────────────────────────
async function revokeUser(username, mspId) {
  const { client, config } = getClient(mspId);

  const adminIdentity = await wallet.getIdentity(config.adminId);
  if (!adminIdentity) throw new Error(`Admin not enrolled for ${mspId}`);

  const body = { id: username };
  const token = buildToken(
    adminIdentity.credentials.certificate,
    adminIdentity.credentials.privateKey,
    body
  );

  await client.post('/revoke', body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    params: { caname: config.caName },
  });

  await wallet.removeIdentity(username);
  console.log(`${username} revoked `);
}

// ── Enroll all admins on startup ───────────────────────
async function enrollAllAdmins() {
  console.log('Enrolling org admins...');
  await enrollAdmin('Org1MSP');
  await enrollAdmin('Org2MSP');
  await enrollAdmin('Org3MSP');
  console.log('All admins enrolled ');
}

module.exports = {
  enrollAdmin,
  enrollAllAdmins,
  registerUser,
  enrollUser,
  revokeUser,
};