import React, { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useHistory } from '../hooks/useInspection'
import { useInspectionContext } from '../context/InspectionContext'

const QUALITY_COLORS = {
  Q1: 'text-emerald-400', Q2: 'text-blue-400', Q3: 'text-orange-400', Q4: 'text-red-400',
}

const ACTION_BADGE = {
  'ROUTE: PREMIUM EXPORT':          'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  'ROUTE: DOMESTIC RETAIL':         'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  'ROUTE: JUICE / AGRO-PROCESSING': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  'REJECT / DISCARD':               'bg-red-500/20 text-red-400 border border-red-500/30',
  'HOLD / RE-INSPECT':              'bg-gray-500/20 text-gray-300 border border-gray-500/30',
}

export function HistoryTable() {
  const { history: apiHistory, pagination, loading, fetchHistory } = useHistory()
  const { inspections } = useInspectionContext()
  const [page, setPage] = useState(1)
  const [qualityFilter, setQualityFilter] = useState('')
  const [healthFilter, setHealthFilter]   = useState('')

  useEffect(() => {
    fetchHistory({
      page,
      limit: 15,
      ...(qualityFilter && { qualityTier: qualityFilter }),
      ...(healthFilter  && { healthStatus: healthFilter }),
    })
  }, [page, qualityFilter, healthFilter, fetchHistory])

  let displayHistory = (apiHistory && apiHistory.length > 0) ? apiHistory : inspections

  if (qualityFilter) {
    displayHistory = displayHistory.filter(r => (r.grading?.qualityTier || r.qualityTier) === qualityFilter)
  }
  if (healthFilter) {
    displayHistory = displayHistory.filter(r => (r.health?.status || r.healthStatus) === healthFilter)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-100">Inspection History</h2>
        <div className="flex items-center gap-3">
          <Filter size={14} className="text-gray-400" />
          <select
            value={qualityFilter}
            onChange={e => { setQualityFilter(e.target.value); setPage(1) }}
            className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-gray-500"
          >
            <option value="">All Quality</option>
            {['Q1','Q2','Q3','Q4'].map(q => <option key={q} value={q}>{q}</option>)}
          </select>
          <select
            value={healthFilter}
            onChange={e => { setHealthFilter(e.target.value); setPage(1) }}
            className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-gray-500"
          >
            <option value="">All Health</option>
            {['Healthy','Alternaria','Anthracnose','Bacterial_Blight','Cercospora'].map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin text-3xl mb-2">⚙</div>Loading...
          </div>
        ) : displayHistory.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <div className="text-5xl mb-3">📜</div>
            <p className="text-base font-medium">No inspection records found</p>
            <p className="text-xs text-gray-500 mt-1">Analyze images on the Live Conveyor Inspection tab to build history</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Image', 'Batch', 'Time', 'Health', 'Ripeness', 'Weight', 'Quality', 'Action', 'Latency'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wide font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayHistory.map((row, i) => (
                  <tr key={row._id || i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      {row.imageUrl ? (
                        <img
                          src={row.imageUrl}
                          alt={row.filename || 'Pomegranate'}
                          className="w-10 h-10 object-cover rounded-lg border border-gray-700 bg-gray-950"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-xs text-gray-500">
                          N/A
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                      {row.batchNumber || 'BATCH-LIVE'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(row.createdAt || row.timestamp || Date.now()).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${row.health?.isHealthy || row.health?.status === 'Healthy' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {row.health?.status || 'Healthy'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs capitalize">
                      {row.ripeness?.stage || 'mature'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs font-mono">
                      {row.grading?.weightTier || 'G1'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${QUALITY_COLORS[row.grading?.qualityTier] || 'text-gray-400'}`}>
                        {row.grading?.qualityTier || 'Q1'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ACTION_BADGE[row.grading?.routingAction || row.sorting?.action] || 'bg-gray-800 text-gray-300'}`}>
                        {(row.grading?.routingAction || row.sorting?.action || 'HOLD').replace('ROUTE: ', '').replace(' / AGRO-PROCESSING', '')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {row.metadata?.processingTimeMs || row.processing_time_ms || 325}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.pages} &bull; {pagination.total} records
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-700 disabled:opacity-30 hover:border-gray-500 transition-colors"
              >
                <ChevronLeft size={14} className="text-gray-400" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page >= (pagination.pages || 1)}
                className="p-1.5 rounded-lg border border-gray-700 disabled:opacity-30 hover:border-gray-500 transition-colors"
              >
                <ChevronRight size={14} className="text-gray-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
