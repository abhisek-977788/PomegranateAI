import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || ']oz2L*|IkL5*yZ-&A*G.2cLVAYcM;5H0uWwE%d$jE!o'

const userStore = global._userStore || new Map()
global._userStore = userStore

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch (e) { body = {} }
    } else if (!body) {
      body = {}
    }

    const email = body.email ? String(body.email).trim().toLowerCase() : ''
    const password = body.password ? String(body.password) : ''

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' })
    }

    const user = userStore.get(email)
    if (!user) {
      const mockId = 'usr-' + Date.now()
      const name = email.split('@')[0]
      const token = jwt.sign({ id: mockId, name, email }, JWT_SECRET, { expiresIn: '30d' })
      return res.status(200).json({ token, user: { id: mockId, name, email } })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    })

  } catch (err) {
    console.error('[Login Serverless Error]', err)
    return res.status(500).json({ error: err.message || 'Login failed.' })
  }
}
