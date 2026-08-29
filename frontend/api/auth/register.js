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

    const name = body.name ? String(body.name).trim() : ''
    const email = body.email ? String(body.email).trim().toLowerCase() : ''
    const password = body.password ? String(body.password) : ''

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide full name, email address, and password.' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' })
    }

    if (userStore.has(email)) {
      return res.status(400).json({ error: 'An account with this email already exists. Please Sign In instead.' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    const userId = 'usr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)

    const userObj = {
      id: userId,
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    }

    userStore.set(email, userObj)

    const token = jwt.sign(
      { id: userId, name, email },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    return res.status(201).json({
      token,
      user: { id: userId, name, email }
    })

  } catch (err) {
    console.error('[Register Serverless Error]', err)
    return res.status(500).json({ error: err.message || 'Registration failed.' })
  }
}
