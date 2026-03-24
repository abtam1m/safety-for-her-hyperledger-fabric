'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const caService = require('../services/ca.service');
const wallet = require('../services/wallet.service');
const { authenticate } = require('../middleware/auth.middleware');
// TEMP DEBUG — remove after fixing
router.get('/debug-ca', async (req, res) => {
  try {
    const https = require('https');
    const axios = require('axios');
    const fs = require('fs');
    const crypto = require('crypto');
    const { execSync } = require('child_process');

    const caCert = fs.readFileSync('/home/tamim/fabric-dev/tfgbv-network/fabric-ca/org1/ca-cert.pem');
    const client = axios.create({
      baseURL: 'https://localhost:8054/api/v1',
      httpsAgent: new https.Agent({ ca: caCert, rejectUnauthorized: false }),
    });

    // Generate real key + CSR
    const { privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    fs.writeFileSync('/tmp/debug-key.pem', privateKey, { mode: 0o600 });
    execSync('openssl req -new -key /tmp/debug-key.pem -out /tmp/debug-csr.pem -subj "/CN=debuguser"');
    const csr = fs.readFileSync('/tmp/debug-csr.pem', 'utf8');
    fs.unlinkSync('/tmp/debug-key.pem');
    fs.unlinkSync('/tmp/debug-csr.pem');

    // Try enroll with real CSR
    const enrollRes = await client.post('', {
      certificate_request: csr,
    }, {
      headers: {
        Authorization: `Basic ${Buffer.from('admin:adminpw').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      params: { caname: 'ca-org1' },
      validateStatus: () => true,
    });

    res.json({
      csrLength: csr.length,
      enrollStatus: enrollRes.status,
      enrollData: enrollRes.data,
    });

  } catch (err) {
    res.json({ error: err.message, stack: err.stack });
  }
});
const JWT_SECRET = process.env.JWT_SECRET || 'safereport-secret-key';

// ── Seed accounts (handlers + authority) ──────────────
// These are pre-registered — victims register themselves
const SEED_USERS = [
  {
    username: 'handler',
    password: 'ngo1234',
    mspId: 'Org2MSP',
    role: 'case_handler',
    displayName: 'NGO Case Handler',
  },
  {
    username: 'authority',
    password: 'legal1234',
    mspId: 'Org3MSP',
    role: 'legal_authority',
    displayName: 'Legal Authority',
  },
];

// ── Enroll seed users on startup ──────────────────────
async function seedUsers() {
  for (const user of SEED_USERS) {
    const exists = await wallet.identityExists(user.username);
    if (!exists) {
      try {
        await caService.registerUser(user);
        console.log(`Seed user ${user.username} ready `);
      } catch (err) {
        console.log(`Register failed (${err.message}), trying enroll only...`);
        try {
          await caService.enrollUser(user);
          console.log(`Seed user ${user.username} enrolled `);
        } catch (e) {
          console.log(`Seed user ${user.username} error: ${e.message}`);
        }
      }
    } else {
      console.log(`Seed user ${user.username} already in wallet `);
    }
  }
}

// ── POST /api/auth/register — victims only ─────────────
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const exists = await wallet.identityExists(username);
    if (exists) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Register in CA then enroll
    await caService.registerUser({
      username,
      password,
      mspId: 'Org1MSP',
      role: 'victim',
      displayName: displayName || 'Anonymous',
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
    });

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ───────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Get identity from wallet
    let identity = await wallet.getIdentity(username);

    if (!identity) {
      // Try enrolling — user may be registered but not enrolled on this machine
      const seedUser = SEED_USERS.find(u => u.username === username);
      if (seedUser && seedUser.password === password) {
        identity = await caService.enrollUser(seedUser);
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Issue JWT
    const token = jwt.sign(
      {
        username,
        org: identity.mspId,
        role: identity.role,
        displayName: identity.displayName,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      user: {
        username,
        org: identity.mspId,
        role: identity.role,
        displayName: identity.displayName,
      },
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/logout ──────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

// ── GET /api/auth/me ───────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    user: {
      username: req.user.username,
      org: req.user.org,
      role: req.user.role,
      displayName: req.user.displayName,
    },
  });
});

module.exports = { router, seedUsers };

// 'use strict';

// const express = require('express');
// const router  = express.Router();
// const jwt     = require('jsonwebtoken');

// const JWT_SECRET = process.env.JWT_SECRET || 'safereport-secret-key';

// const USERS = [
//   { id:1, username:'victim',    password:'safe1234',  org:'Org1MSP', role:'victim',          displayName:'Anonymous Reporter' },
//   { id:2, username:'handler',   password:'ngo1234',   org:'Org2MSP', role:'case_handler',    displayName:'NGO Case Handler'   },
//   { id:3, username:'authority', password:'legal1234', org:'Org3MSP', role:'legal_authority', displayName:'Legal Authority'    },
// ];

// // POST /api/auth/login
// router.post('/login', (req, res) => {
//   const { username, password } = req.body;

//   if (!username || !password) {
//     return res.status(400).json({ error: 'Username and password required' });
//   }

//   const user = USERS.find(u => u.username === username && u.password === password);

//   if (!user) {
//     return res.status(401).json({ error: 'Invalid credentials' });
//   }

//   const token = jwt.sign(
//     { id: user.id, org: user.org, role: user.role, displayName: user.displayName },
//     JWT_SECRET,
//     { expiresIn: '8h' }
//   );

//   res.json({
//     success: true,
//     token,
//     user: {
//       username:    user.username,
//       org:         user.org,
//       role:        user.role,
//       displayName: user.displayName,
//     }
//   });
// });

// // POST /api/auth/logout
// router.post('/logout', (req, res) => {
//   res.json({ success: true, message: 'Logged out' });
// });

// module.exports = router;