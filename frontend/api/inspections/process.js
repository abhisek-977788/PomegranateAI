import axios from 'axios'

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

const inMemoryInspections = global._inMemoryInspections || []
global._inMemoryInspections = inMemoryInspections

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/api/v1/predict`, req, {
      headers: {
        'content-type': req.headers['content-type'],
      },
      timeout: 120000,
    })

    const predictions = mlResponse.data.predictions || []
    const batchNumber = 'BATCH-' + Date.now()

    for (const item of predictions) {
      if (!item.error) {
        inMemoryInspections.unshift({
          _id: 'insp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          batchNumber,
          filename: item.filename,
          health: item.health,
          ripeness: item.ripeness,
          grading: item.grading,
          sorting: item.sorting,
          metadata: { processingTimeMs: item.processing_time_ms },
          createdAt: new Date().toISOString(),
        })
      }
    }

    return res.status(201).json({
      batchNumber,
      count: predictions.length,
      results: predictions,
    })

  } catch (err) {
    console.error('[Process Error]', err.response?.data || err.message)
    const detail = err.response?.data?.detail || err.response?.data?.error || err.message
    return res.status(err.response?.status || 500).json({
      error: typeof detail === 'string' ? detail : JSON.stringify(detail),
    })
  }
}
