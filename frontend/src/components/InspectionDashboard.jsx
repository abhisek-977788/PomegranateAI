import React, { useState, useCallback } from 'react'
import { AlertCircle, Trash2 } from 'lucide-react'
import { UploadZone } from './UploadZone'
import { ResultCard }  from './ResultCard'
import { useInspection } from '../hooks/useInspection'
import { useInspectionContext } from '../context/InspectionContext'

export function InspectionDashboard() {
  const { loading, error, results: currentResults, uploadProgress, processImages, clearResults: clearCurrent } = useInspection()
  const { inspections, addInspections, clearInspections } = useInspectionContext()
  const [previews, setPreviews] = useState([])

  const handleProcess = useCallback(async (files) => {
    const urls = files.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    clearCurrent()
    try {
      const res = await processImages(files)
      if (res && res.results && res.results.length > 0) {
        addInspections(res.results)
      }
    } catch (_) {}
  }, [processImages, clearCurrent, addInspections])

  // Combine current batch results with persistent inspections
  const displayResults = currentResults.length > 0 ? currentResults : inspections

  const handleClearAll = () => {
    clearCurrent()
    clearInspections()
    setPreviews([])
  }

  return (
    <div className="space-y-8">
      {/* Upload section */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-gray-100 mb-4">
          Live Conveyor Inspection
        </h2>
        <UploadZone
          onProcess={handleProcess}
          loading={loading}
          uploadProgress={uploadProgress}
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 bg-red-950/40 border border-red-500/40 rounded-2xl p-4">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-red-400 font-semibold">
              {String(error).includes('not a pomegranate') ? 'Validation Failed' : 'Inference Failed'}
            </p>
            <p className="text-red-300/90 text-sm mt-0.5 font-medium">
              {typeof error === 'string' ? error : (error?.message || JSON.stringify(error))}
            </p>
            {!String(error).includes('not a pomegranate') && (
              <p className="text-gray-500 text-xs mt-1">
                Ensure the ML service is running at the configured URL.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Results grid */}
      {displayResults.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-200">
              Inspection Results
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({displayResults.length} image{displayResults.length > 1 ? 's' : ''})
              </span>
            </h3>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          </div>

          {/* Routing summary badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            {['ROUTE: PREMIUM EXPORT','ROUTE: DOMESTIC RETAIL','ROUTE: JUICE / AGRO-PROCESSING','REJECT / DISCARD','HOLD / RE-INSPECT'].map(action => {
              const count = displayResults.filter(r => (r.grading?.routingAction || r.sorting?.action) === action).length
              if (count === 0) return null
              const colors = {
                'ROUTE: PREMIUM EXPORT':          'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                'ROUTE: DOMESTIC RETAIL':         'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                'ROUTE: JUICE / AGRO-PROCESSING': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                'REJECT / DISCARD':               'bg-red-500/20 text-red-400 border-red-500/30',
                'HOLD / RE-INSPECT':              'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
              }
              return (
                <span key={action} className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[action]}`}>
                  {count} &times; {action}
                </span>
              )
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayResults.map((result, idx) => (
              <ResultCard
                key={result._id || idx}
                result={result}
                imageUrl={result.imageUrl || previews[idx]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && displayResults.length === 0 && !error && (
        <div className="text-center py-16 text-gray-600">
          <div className="text-6xl mb-4">🍎</div>
          <p className="text-lg font-medium">Upload pomegranate images to begin inspection</p>
          <p className="text-sm mt-2">Supports JPG, PNG, WebP - up to 20 images per batch</p>
        </div>
      )}
    </div>
  )
}
