const mongoose = require('mongoose');

const BBoxSchema = new mongoose.Schema({
  xmin:       { type: Number },
  ymin:       { type: Number },
  xmax:       { type: Number },
  ymax:       { type: Number },
  label:      { type: String },
  confidence: { type: Number },
}, { _id: false });

const InspectionSchema = new mongoose.Schema({
  // User ownership
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: false,
  },

  // Batch identification
  batchNumber: {
    type:    String,
    index:   true,
    default: () => 'BATCH-' + Date.now(),
  },
  imageUrl: { type: String, default: '' },

  // Disease / defect screening
  health: {
    status:      { type: String, default: 'Healthy' },   // open string — no enum constraint
    isHealthy:   { type: Boolean, default: true },
    confidence:  { type: Number, min: 0, max: 1, default: 0 },
    defectCount: { type: Number, min: 0, default: 0 },
    bboxes:      { type: [BBoxSchema], default: [] },
    allProbs:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },

  // Growth / ripeness stage
  ripeness: {
    stage:      { type: String, default: 'unknown' },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    isMature:   { type: Boolean, default: false },
    allProbs:   { type: mongoose.Schema.Types.Mixed, default: {} },
  },

  // Weight tier + quality tier + routing
  grading: {
    weightTier:        { type: String, default: 'G2' },
    weightConfidence:  { type: Number, min: 0, max: 1, default: 0 },
    qualityTier:       { type: String, default: 'Q2' },
    qualityConfidence: { type: Number, min: 0, max: 1, default: 0 },
    routingAction:     { type: String, default: 'HOLD / RE-INSPECT' },
    badgeColor:        { type: String, default: 'yellow' },
  },

  // Processing metadata
  metadata: {
    processingTimeMs: { type: Number, default: 0 },
    cameraAngle:      { type: String, default: 'front' },
    originalFilename: { type: String, default: '' },
  },

}, {
  // timestamps: true auto-adds createdAt and updatedAt (indexed by Mongoose)
  timestamps: true,
});

// Compound + single-field indexes for common query patterns
InspectionSchema.index({ createdAt: -1 });                  // history sort
InspectionSchema.index({ 'grading.qualityTier':  1 });      // filter by quality
InspectionSchema.index({ 'grading.routingAction': 1 });     // aggregation grouping
InspectionSchema.index({ 'health.status': 1 });             // filter by health
InspectionSchema.index({ batchNumber: 1, createdAt: -1 });  // batch history sort

module.exports = mongoose.model('Inspection', InspectionSchema);
