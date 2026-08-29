const FormData   = require('form-data');
const axios      = require('axios');
const mongoose   = require('mongoose');
const Inspection = require('../models/Inspection');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inspections/process
// Accepts multipart/form-data with `images[]`, streams to ML service,
// stores each prediction in MongoDB, returns saved documents.
// ─────────────────────────────────────────────────────────────────────────────
async function processInspection(req, res) {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No files uploaded. Send images as multipart/form-data with field name "images".' });

    const batchNumber = req.body.batchNumber || ('BATCH-' + Date.now());
    const cameraAngle = req.body.cameraAngle  || 'front';

    // Build multipart form for ML microservice
    const form = new FormData();
    for (const file of req.files) {
      form.append('files', file.buffer, {
        filename:    file.originalname,
        contentType: file.mimetype || 'image/jpeg',
      });
    }

    // Call ML microservice
    let mlData;
    try {
      const response = await axios.post(ML_URL + '/api/v1/predict', form, {
        headers:           form.getHeaders(),
        maxContentLength:  Infinity,
        maxBodyLength:     Infinity,
        timeout:           120_000,
      });
      mlData = response.data;
    } catch (mlErr) {
      const detail = mlErr.response?.data || mlErr.message;
      console.error('[processInspection] ML service error:', detail);
      return res.status(502).json({
        error:  'ML service unavailable or returned an error',
        detail: typeof detail === 'object' ? JSON.stringify(detail) : detail,
        mlUrl:  ML_URL,
      });
    }

    // Persist each prediction to MongoDB
    const saved = [];
    for (const pred of (mlData.predictions || [])) {
      if (pred.error || pred.is_pomegranate === false) {
        saved.push({
          error: pred.error || 'Uploaded image is not a pomegranate.',
          filename: pred.filename,
          isPomegranate: false,
        });
        continue;
      }

      const doc = new Inspection({
        userId: req.user ? req.user.id : null,
        batchNumber,
        imageUrl: pred.filename || '',

        health: {
          status:      pred.health.status,
          isHealthy:   pred.health.is_healthy,
          confidence:  pred.health.confidence,
          defectCount: pred.health.defect_count,
          bboxes:      pred.health.bboxes || [],
          allProbs:    pred.health.all_probs || {},
        },

        ripeness: {
          stage:      pred.ripeness.stage,
          confidence: pred.ripeness.confidence,
          isMature:   pred.ripeness.is_mature,
          allProbs:   pred.ripeness.all_probs || {},
        },

        grading: {
          weightTier:        pred.grading.weight_tier,
          weightConfidence:  pred.grading.weight_confidence,
          qualityTier:       pred.grading.quality_tier,
          qualityConfidence: pred.grading.quality_confidence,
          routingAction:     pred.sorting.action,
          badgeColor:        pred.sorting.badge_color,
        },

        metadata: {
          processingTimeMs: pred.processing_time_ms,
          cameraAngle,
          originalFilename: pred.filename || '',
        },
      });

      try {
        if (mongoose.connection.readyState === 1) {
          await doc.save();
          saved.push(doc.toObject());
        } else {
          // If MongoDB is offline/disconnected, return plain result object
          const raw = doc.toObject();
          raw._id = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
          saved.push(raw);
        }
      } catch (dbErr) {
        console.warn('[inspectionController] DB save warning:', dbErr.message);
        const raw = doc.toObject();
        raw._id = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        saved.push(raw);
      }
    }

    const invalidCount = saved.filter(s => s.error).length;
    if (invalidCount > 0 && invalidCount === saved.length) {
      return res.status(400).json({
        error: saved[0].error || 'Uploaded image is not a pomegranate.',
        batchNumber,
        count: saved.length,
        results: saved,
      });
    }

    return res.status(201).json({ batchNumber, count: saved.length, results: saved });

  } catch (err) {
    console.error('[processInspection] unexpected error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inspections/batches
// Returns per-batch aggregated metrics: total, export %, defect %, counts.
// ─────────────────────────────────────────────────────────────────────────────
async function getBatchMetrics(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ batches: [], total: 0 });
    }
    const matchUser = req.user ? [{ '$match': { userId: new mongoose.Types.ObjectId(req.user.id) } }] : [];
    const pipeline = [
      ...matchUser,
      {
        '$group': {
          _id:         '$batchNumber',
          total:       { '$sum': 1 },
          exportCount: { '$sum': { '$cond': [{ '$eq': ['$grading.routingAction', 'ROUTE: PREMIUM EXPORT'] },         1, 0] } },
          retailCount: { '$sum': { '$cond': [{ '$eq': ['$grading.routingAction', 'ROUTE: DOMESTIC RETAIL'] },        1, 0] } },
          juiceCount:  { '$sum': { '$cond': [{ '$eq': ['$grading.routingAction', 'ROUTE: JUICE / AGRO-PROCESSING'] },1, 0] } },
          rejectCount: { '$sum': { '$cond': [{ '$eq': ['$grading.routingAction', 'REJECT / DISCARD'] },              1, 0] } },
          holdCount:   { '$sum': { '$cond': [{ '$eq': ['$grading.routingAction', 'HOLD / RE-INSPECT'] },             1, 0] } },
          lastUpdated: { '$max': '$createdAt' },
          firstSeen:   { '$min': '$createdAt' },
        },
      },
      {
        '$addFields': {
          exportYieldPct: { '$round': [{ '$multiply': [{ '$divide': ['$exportCount', '$total'] }, 100] }, 1] },
          defectRatePct:  { '$round': [{ '$multiply': [{ '$divide': ['$rejectCount',  '$total'] }, 100] }, 1] },
        },
      },
      { '$sort': { lastUpdated: -1 } },
    ];

    const batches = await Inspection.aggregate(pipeline);
    return res.json({ batches, total: batches.length });
  } catch (err) {
    console.error('[getBatchMetrics]', err.message);
    return res.json({ batches: [], total: 0 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inspections/history
// Paginated list with filtering. Query params:
//   page, limit, qualityTier, healthStatus, batchNumber, from, to
// ─────────────────────────────────────────────────────────────────────────────
async function getHistory(req, res) {
  try {
    const page  = Math.max(parseInt(req.query.page  || '1',  10), 1);
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const skip  = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
      return res.json({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0, hasNext: false, hasPrev: false }
      });
    }

    const filter = {};
    if (req.user)               filter.userId                 = new mongoose.Types.ObjectId(req.user.id);
    if (req.query.qualityTier)  filter['grading.qualityTier'] = req.query.qualityTier;
    if (req.query.healthStatus) filter['health.status']       = req.query.healthStatus;
    if (req.query.batchNumber)  filter.batchNumber            = req.query.batchNumber;
    if (req.query.routingAction) filter['grading.routingAction'] = req.query.routingAction;

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt['$gte'] = new Date(req.query.from);
      if (req.query.to)   filter.createdAt['$lte'] = new Date(req.query.to);
    }

    const [total, docs] = await Promise.all([
      Inspection.countDocuments(filter),
      Inspection.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      data:       docs,
      pagination: {
        page,
        limit,
        total,
        pages:   Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error('[getHistory]', err.message);
    return res.json({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0, hasNext: false, hasPrev: false }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inspections/stats
// Global aggregate statistics for the analytics dashboard.
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inspections/stats
// Global aggregate statistics for the analytics dashboard.
// ─────────────────────────────────────────────────────────────────────────────
async function getStats(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        totalInspections: 0, exportCount: 0, rejectCount: 0, holdCount: 0,
        exportYieldPct: 0, defectRatePct: 0, avgProcTimeMs: 0,
        distributions: { maturity: {}, quality: {}, health: {}, routing: {} }
      });
    }

    const matchUser = req.user ? [{ '$match': { userId: new mongoose.Types.ObjectId(req.user.id) } }] : [];

    const [totals, maturity, quality, health, routing] = await Promise.all([
      // Overall summary
      Inspection.aggregate([
        ...matchUser,
        {
          '$group': {
            _id:         null,
            total:       { '$sum': 1 },
            exportCount: { '$sum': { '$cond': [{ '$eq': ['$grading.routingAction', 'ROUTE: PREMIUM EXPORT'] },         1, 0] } },
            rejectCount: { '$sum': { '$cond': [{ '$eq': ['$grading.routingAction', 'REJECT / DISCARD'] },              1, 0] } },
            holdCount:   { '$sum': { '$cond': [{ '$eq': ['$grading.routingAction', 'HOLD / RE-INSPECT'] },             1, 0] } },
            avgProcTime: { '$avg': '$metadata.processingTimeMs' },
          },
        }
      ]),

      // Maturity stage distribution
      Inspection.aggregate([
        ...matchUser,
        { '$group': { _id: '$ripeness.stage', count: { '$sum': 1 } } },
        { '$sort': { count: -1 } },
      ]),

      // Quality tier distribution
      Inspection.aggregate([
        ...matchUser,
        { '$group': { _id: '$grading.qualityTier', count: { '$sum': 1 } } },
        { '$sort': { _id: 1 } },
      ]),

      // Health / disease distribution
      Inspection.aggregate([
        ...matchUser,
        { '$group': { _id: '$health.status', count: { '$sum': 1 } } },
        { '$sort': { count: -1 } },
      ]),

      // Routing action distribution
      Inspection.aggregate([
        ...matchUser,
        { '$group': { _id: '$grading.routingAction', count: { '$sum': 1 } } },
        { '$sort': { count: -1 } },
      ]),
    ]);

    const t = totals[0] || { total: 0, exportCount: 0, rejectCount: 0, holdCount: 0, avgProcTime: 0 };
    const pct = (n) => t.total ? +((n / t.total) * 100).toFixed(1) : 0;

    return res.json({
      summary: {
        totalProcessed:     t.total,
        exportViabilityPct: pct(t.exportCount),
        defectRatePct:      pct(t.rejectCount),
        holdRatePct:        pct(t.holdCount),
        avgProcessingMs:    Math.round(t.avgProcTime || 0),
      },
      maturityDistribution: maturity,
      qualityDistribution:  quality,
      healthDistribution:   health,
      routingDistribution:  routing,
    });

  } catch (err) {
    console.error('[getStats]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { processInspection, getBatchMetrics, getHistory, getStats };
