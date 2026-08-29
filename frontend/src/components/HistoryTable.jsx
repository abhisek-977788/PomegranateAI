import React, { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useHistory } from '../hooks/useInspection'

const QUALITY_COLORS = {
  Q1: 'text-emerald-400', Q2: 'text-blue-400', Q3: 'text-orange-400', Q4: 'text-red-400',
}

const ACTION_BADGE = {
  'ROUTE: PREMIUM EXPORT':          'bg-yellow-500/20 text-yellow-400',
  'ROUTE: DOMESTIC RETAIL':         'bg-emerald-500/20 text-emerald-400',
  'ROUTE: JUICE / AGRO-PROCESSING': 'bg-orange-500/20 text-orange-400',
  'REJECT / DISCARD':               'bg-red-500/20 text-red-400',
  'HOLD / RE-INSPECT':              'bg-gray-500/20 text-gray-400',
}

export function HistoryTable() {
  const { history, pagination, loading, fetchHistory } = useHistory()
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
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-gray-600">No inspection records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Batch','Time','Health','Ripeness','Weight','Quality','Action','Latency'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wide font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={row._id || i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{row.batchNumber}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(row.createdAt || row.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${row.health?.isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                        {row.health?.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs capitalize">{row.ripeness?.stage}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs font-mono">{row.grading?.weightTier}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${QUALITY_COLORS[row.grading?.qualityTier] || 'text-gray-400'}`}>
                        {row.grading?.qualityTier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_BADGE[row.grading?.routingAction] || 'text-gray-400'}`}>
                        {row.grading?.routingAction?.replace('ROUTE: ', '').replace(' / AGRO-PROCESSING', '')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{row.metadata?.processingTimeMs}ms</td>
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
