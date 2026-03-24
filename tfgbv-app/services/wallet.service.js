'use strict';

const path = require('path');
const fs = require('fs-extra');

const WALLET_PATH = path.join(__dirname, '..', 'wallet');

// Ensure wallet directory exists
fs.ensureDirSync(WALLET_PATH);

// ── Save identity to wallet ────────────────────────────
async function putIdentity(label, identity) {
  const filePath = path.join(WALLET_PATH, `${label}.json`);
  await fs.writeJSON(filePath, identity, { spaces: 2 });
}

// ── Get identity from wallet ───────────────────────────
async function getIdentity(label) {
  const filePath = path.join(WALLET_PATH, `${label}.json`);
  if (!await fs.pathExists(filePath)) return null;
  return fs.readJSON(filePath);
}

// ── Check if identity exists ───────────────────────────
async function identityExists(label) {
  const filePath = path.join(WALLET_PATH, `${label}.json`);
  return fs.pathExists(filePath);
}

// ── Remove identity from wallet ────────────────────────
async function removeIdentity(label) {
  const filePath = path.join(WALLET_PATH, `${label}.json`);
  if (await fs.pathExists(filePath)) {
    await fs.remove(filePath);
    return true;
  }
  return false;
}

// ── List all identities ────────────────────────────────
async function listIdentities() {
  const files = await fs.readdir(WALLET_PATH);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

module.exports = {
  putIdentity,
  getIdentity,
  identityExists,
  removeIdentity,
  listIdentities,
  WALLET_PATH
};