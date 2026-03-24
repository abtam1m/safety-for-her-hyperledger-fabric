'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { router: authRoutes, seedUsers } = require('./routes/auth.routes');
const reportRoutes = require('./routes/report.routes');
const evidenceRoutes = require('./routes/evidence.routes');
const referralRoutes = require('./routes/referral.routes');
const caService = require('./services/ca.service');

const app = express();

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'TFGBV Safe Reporting API', status: 'running', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/referrals', referralRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Enroll all org admins first
    await caService.enrollAllAdmins();

    // Seed handler + authority accounts
    await seedUsers();

    app.listen(PORT, () => {
      console.log(` TFGBV API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

// 'use strict';

// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');

// const authRoutes = require('./routes/auth.routes');
// const reportRoutes = require('./routes/report.routes');
// const evidenceRoutes = require('./routes/evidence.routes');
// const referralRoutes = require('./routes/referral.routes');

// const app = express();

// app.use(cors({ origin: 'http://localhost:3000' }));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Health check
// app.get('/', (req, res) => {
//   res.json({ message: 'TFGBV Safe Reporting API', status: 'running', version: '1.0.0' });
// });

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/reports', reportRoutes);
// app.use('/api/evidence', evidenceRoutes);
// app.use('/api/referrals', referralRoutes);

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ error: 'Something went wrong' });
// });

// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//   console.log(` TFGBV API running on http://localhost:${PORT}`);
// });
