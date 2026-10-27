const express = require('express');
const accountService = require('../services/accountService');

const router = express.Router();

// Dashboard summary: totals across all accounts plus the most recent transactions.
router.get('/', async (req, res) => {
  res.json({ data: await accountService.getStats() });
});

module.exports = router;
