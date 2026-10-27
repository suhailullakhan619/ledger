const express = require('express');
const { validate } = require('../middleware/validate');
const { createTransferBody } = require('../validators/schemas');
const transferService = require('../services/transferService');

const router = express.Router();

// 9. Bonus: money transfer
router.post('/', validate(createTransferBody), async (req, res) => {
  res.status(201).json({ data: await transferService.createTransfer(req.validated.body) });
});

module.exports = router;
