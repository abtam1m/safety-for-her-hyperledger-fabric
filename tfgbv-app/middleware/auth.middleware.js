'use strict';

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'safereport-secret-key';

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.org = decoded.org;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

function requireOrg(...allowedOrgs) {
  return [
    authenticate,
    (req, res, next) => {
      if (!allowedOrgs.includes(req.org)) {
        return res.status(403).json({
          error: `Access denied. Required: ${allowedOrgs.join(' or ')}`
        });
      }
      next();
    }
  ];
}

module.exports = { authenticate, requireOrg };
