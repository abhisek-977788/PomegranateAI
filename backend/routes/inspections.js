const express = require('express');
const multer  = require('multer');
const {
  processInspection, getBatchMetrics, getHistory, getStats,
} = require('../controllers/inspectionController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/process', upload.array('images', 20), processInspection);
router.get('/batches',  getBatchMetrics);
router.get('/history',  getHistory);
router.get('/stats',    getStats);

module.exports = router;