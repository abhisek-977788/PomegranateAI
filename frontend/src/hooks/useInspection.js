import { useState, useCallback } from 'react'
import { inspectionApi } from '../api/client'

function fileToDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

export function useInspection() {
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [results,    setResults]    = useState([])
  const [uploadProgress, setUploadProgress] = useState(0)

  const processImages = useCallback(async (files, batchNumber = '', cameraAngle = 'front') => {
    setLoading(true); setError(null); setResults([]); setUploadProgress(0)
    try {
      const form = new FormData()
      files.forEach(f => form.append('images', f))
      if (batchNumber) form.append('batchNumber', batchNumber)
      form.append('cameraAngle', cameraAngle)

      // Convert files to base64 Data URLs for thumbnail persistence
      const dataUrls = await Promise.all(files.map(f => fileToDataURL(f)))

      const { data } = await inspectionApi.process(form, (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })

      const enrichedResults = (data.results || []).map((res, i) => ({
        ...res,
        imageUrl: dataUrls[i] || res.imageUrl || res.filename || '',
        createdAt: res.createdAt || new Date().toISOString(),
      }))

      setResults(enrichedResults)
      return { ...data, results: enrichedResults }
    } catch (err) {
      const raw = err.response?.data?.error || err.message || 'Request failed'
      const msg = typeof raw === 'string' ? raw : (raw?.message || JSON.stringify(raw))
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearResults = useCallback(() => {
    setResults([]); setError(null); setUploadProgress(0)
  }, [])

  return { loading, error, results, uploadProgress, processImages, clearResults }
}

export function useStats() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const fetchStats = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await inspectionApi.getStats()
      setStats(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { stats, loading, error, fetchStats }
}

export function useHistory() {
  const [history,  setHistory]  = useState([])
  const [pagination, setPagination] = useState({})
  const [loading,  setLoading]  = useState(false)

  const fetchHistory = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      const { data } = await inspectionApi.getHistory(params)
      setHistory(data.data || [])
      setPagination(data.pagination || {})
    } finally {
      setLoading(false)
    }
  }, [])

  return { history, pagination, loading, fetchHistory }
}
