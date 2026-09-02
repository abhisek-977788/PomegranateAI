import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const InspectionContext = createContext()

const STORAGE_KEY = 'pomegranate_inspections_history'

export function InspectionProvider({ children }) {
  const [inspections, setInspections] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      console.error('[InspectionContext] Failed to load history from localStorage', e)
      return []
    }
  })

  // Sync to localStorage whenever inspections state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inspections))
    } catch (e) {
      console.error('[InspectionContext] Failed to save history to localStorage', e)
    }
  }, [inspections])

  const addInspections = useCallback((newItems) => {
    if (!Array.isArray(newItems) || newItems.length === 0) return
    setInspections((prev) => {
      // Prepend new items to front of array
      const updated = [...newItems, ...prev]
      return updated
    })
  }, [])

  const clearInspections = useCallback(() => {
    setInspections([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Calculate live analytics stats from saved inspections
  const getStats = useCallback(() => {
    const validDocs = inspections.filter((item) => item && !item.error && item.grading)
    const totalProcessed = validDocs.length

    if (totalProcessed === 0) {
      return {
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
      }
    }

    let exportCount = 0
    let rejectCount = 0
    let holdCount = 0
    let totalProcTime = 0

    const maturityCounts = {}
    const qualityCounts = {}
    const healthCounts = {}
    const routingCounts = {}

    for (const item of validDocs) {
      const routingAction = item.grading?.routingAction || item.sorting?.action || ''
      if (routingAction.includes('PREMIUM EXPORT')) exportCount++
      else if (routingAction.includes('REJECT') || routingAction.includes('DISCARD')) rejectCount++
      else if (routingAction.includes('HOLD') || routingAction.includes('RE-INSPECT')) holdCount++

      const procMs = item.metadata?.processingTimeMs || item.processing_time_ms || 325
      totalProcTime += procMs

      // Maturity
      const mat = item.ripeness?.stage || 'Unknown'
      maturityCounts[mat] = (maturityCounts[mat] || 0) + 1

      // Quality
      const q = item.grading?.qualityTier || 'Unknown'
      qualityCounts[q] = (qualityCounts[q] || 0) + 1

      // Health
      const h = item.health?.status || 'Unknown'
      healthCounts[h] = (healthCounts[h] || 0) + 1

      // Routing
      routingCounts[routingAction] = (routingCounts[routingAction] || 0) + 1
    }

    const pct = (val) => +((val / totalProcessed) * 100).toFixed(1)

    return {
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
    }
  }, [inspections])

  return (
    <InspectionContext.Provider
      value={{
        inspections,
        addInspections,
        clearInspections,
        getStats,
      }}
    >
      {children}
    </InspectionContext.Provider>
  )
}

export function useInspectionContext() {
  const context = useContext(InspectionContext)
  if (!context) {
    throw new Error('useInspectionContext must be used within an InspectionProvider')
  }
  return context
}
