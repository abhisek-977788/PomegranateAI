import React from 'react'
import { Shield, Leaf, Scale, Star, ArrowRight } from 'lucide-react'

const BADGE_COLORS = {
  gold:   'bg-yellow-500 text-yellow-950',
  green:  'bg-emerald-500 text-emerald-950',
  orange: 'bg-orange-500 text-orange-950',
  yellow: 'bg-yellow-400 text-yellow-950',
  red:    'bg-red-600 text-white',
}

const HEALTH_COLORS = {
  Healthy:          'text-emerald-400 bg-emerald-400/10',
  Alternaria:       'text-red-400 bg-red-400/10',
  Anthracnose:      'text-orange-400 bg-orange-400/10',
  Bacterial_Blight: 'text-yellow-400 bg-yellow-400/10',
  Cercospora:       'text-purple-400 bg-purple-400/10',
}

const QUALITY_LABELS = {
  Q1: 'Export Grade',
  Q2: 'Retail Standard',
  Q3: 'Juice/Processing',
  Q4: 'Cull/Reject',
}

const WEIGHT_LABELS = {
  G1: '300-400g',
  G2: '200-300g',
  G3: '100-200g',
}

function StatCard({ icon: Icon, label, value, subValue, colorClass }) {
  return (
    <div className={`rounded-xl p-3 border border-gray-700 ${colorClass || 'bg-gray-800'}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="opacity-60" />
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      {subValue && <p className="text-xs text-gray-400 mt-0.5">{subValue}</p>}
    </div>
  )
}

export function ResultCard({ result, imageUrl }) {
  if (!result || result.error) {
    return (
      <div className="bg-gray-800 rounded-2xl p-4 border border-red-500/40">
        <p className="text-red-400 font-medium">Error: {result?.error || 'Unknown error'}</p>
        <p className="text-gray-500 text-sm mt-1">{result?.filename || result?.imageUrl || 'Unknown image'}</p>
      </div>
    )
  }

  // Normalize properties from either Mongo Inspection doc or raw ML prediction
  const health = result.health || {}
  const ripeness = result.ripeness || {}
  const grading = result.grading || {}
  const sorting = result.sorting || {}
  const metadata = result.metadata || {}

  const healthStatus = health.status || 'Healthy'
  const healthConfidence = health.confidence ?? 0
  const isHealthy = health.isHealthy ?? health.is_healthy ?? (healthStatus === 'Healthy')
  const allProbs = health.allProbs || health.all_probs || {}

  const ripenessStage = ripeness.stage || 'unknown'
  const ripenessConfidence = ripeness.confidence ?? 0

  const weightTier = grading.weightTier || grading.weight_tier || 'G2'
  const qualityTier = grading.qualityTier || grading.quality_tier || 'Q2'

  const routingAction = grading.routingAction || sorting.action || 'HOLD / RE-INSPECT'
  const badgeColor = grading.badgeColor || sorting.badge_color || 'yellow'

  const processingTime = metadata.processingTimeMs ?? result.processing_time_ms ?? 0
  const filename = metadata.originalFilename || result.imageUrl || result.filename || 'Inspection'

  const badgeClass = BADGE_COLORS[badgeColor] || BADGE_COLORS.yellow
  const healthClass = HEALTH_COLORS[healthStatus] || HEALTH_COLORS.Healthy

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <p className="text-sm text-gray-300 font-mono truncate max-w-48">{filename}</p>
          <p className="text-xs text-gray-500">{processingTime}ms</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${badgeClass}`}>
          {routingAction}
        </span>
      </div>

      {/* Image preview */}
      {imageUrl && (
        <div className="relative bg-black aspect-video">
          <img src={imageUrl} alt={filename} className="w-full h-full object-contain" />
          {!isHealthy && (
            <div className="absolute inset-0 border-2 border-red-500/60 rounded pointer-events-none" />
          )}
        </div>
      )}

      {/* Metric cards grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <StatCard
          icon={Shield}
          label="Health"
          value={healthStatus}
          subValue={(healthConfidence * 100).toFixed(0) + '% confidence'}
          colorClass={healthClass}
        />
        <StatCard
          icon={Leaf}
          label="Ripeness"
          value={ripenessStage.charAt(0).toUpperCase() + ripenessStage.slice(1)}
          subValue={(ripenessConfidence * 100).toFixed(0) + '% confidence'}
          colorClass="bg-gray-800"
        />
        <StatCard
          icon={Scale}
          label="Weight Tier"
          value={weightTier}
          subValue={WEIGHT_LABELS[weightTier] || weightTier}
          colorClass="bg-gray-800"
        />
        <StatCard
          icon={Star}
          label="Quality"
          value={qualityTier}
          subValue={QUALITY_LABELS[qualityTier] || qualityTier}
          colorClass="bg-gray-800"
        />
      </div>

      {/* Confidence bars */}
      <div className="px-4 pb-4 space-y-2">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Disease Probabilities</p>
        {Object.entries(allProbs).map(([cls, prob]) => (
          <div key={cls} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-28 truncate">{cls}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-red-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, prob * 100))}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-8 text-right">{(prob * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
