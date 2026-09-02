const inMemoryInspections = global._inMemoryInspections || []
global._inMemoryInspections = inMemoryInspections

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const totalProcessed = inMemoryInspections.length

  if (totalProcessed === 0) {
    return res.status(200).json({
      summary: {
        totalProcessed: 0,
        exportViabilityPct: 0,
        defectRatePct: 0,
        holdRatePct: 0,
        avgProcessingMs: 0,
      },
      maturityDistribution: [],
      qualityDistribution: [],
      healthDistribution: [],
      routingDistribution: [],
    })
  }

  let exportCount = 0
  let rejectCount = 0
  let holdCount = 0
  let totalProcTime = 0

  const maturityCounts = {}
  const qualityCounts = {}
  const healthCounts = {}
  const routingCounts = {}

  for (const item of inMemoryInspections) {
    const action = item.grading?.routingAction || item.sorting?.action || ''
    if (action.includes('PREMIUM EXPORT')) exportCount++
    else if (action.includes('REJECT') || action.includes('DISCARD')) rejectCount++
    else if (action.includes('HOLD') || action.includes('RE-INSPECT')) holdCount++

    totalProcTime += (item.metadata?.processingTimeMs || 325)

    const mat = item.ripeness?.stage || 'mature'
    maturityCounts[mat] = (maturityCounts[mat] || 0) + 1

    const q = item.grading?.qualityTier || 'Q1'
    qualityCounts[q] = (qualityCounts[q] || 0) + 1

    const h = item.health?.status || 'Healthy'
    healthCounts[h] = (healthCounts[h] || 0) + 1

    routingCounts[action] = (routingCounts[action] || 0) + 1
  }

  const pct = (val) => +((val / totalProcessed) * 100).toFixed(1)

  return res.status(200).json({
    summary: {
      totalProcessed,
      exportViabilityPct: pct(exportCount),
      defectRatePct: pct(rejectCount),
      holdRatePct: pct(holdCount),
      avgProcessingMs: Math.round(totalProcTime / totalProcessed),
    },
    maturityDistribution: Object.entries(maturityCounts).map(([_id, count]) => ({ _id, count })),
    qualityDistribution: Object.entries(qualityCounts).map(([_id, count]) => ({ _id, count })),
    healthDistribution: Object.entries(healthCounts).map(([_id, count]) => ({ _id, count })),
    routingDistribution: Object.entries(routingCounts).map(([_id, count]) => ({ _id, count })),
  })
}
