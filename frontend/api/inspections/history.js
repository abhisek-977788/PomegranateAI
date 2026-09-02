const inMemoryInspections = global._inMemoryInspections || []
global._inMemoryInspections = inMemoryInspections

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  return res.status(200).json({
    data: inMemoryInspections,
    pagination: {
      page: 1,
      limit: 20,
      total: inMemoryInspections.length,
      pages: Math.ceil(inMemoryInspections.length / 20) || 1,
      hasNext: false,
      hasPrev: false,
    },
  })
}
