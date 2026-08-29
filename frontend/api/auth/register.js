const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || ']oz2L*|IkL5*yZ-&A*G.2cLVAYcM;5H0uWwE%d$jE!o';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://abhisekpatel8917_db_user:Abhi1234@cluster0.epxf3si.mongodb.net/pomegranate_db?retryWrites=true&w=majority&appName=Cluster0';

const inMemoryUsers = new Map();

let User;
try {
  User = mongoose.model('User');
} catch (e) {
  const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
  }, { timestamps: true });
  User = mongoose.model('User', UserSchema);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    } else if (!body) {
      body = {};
    }

    const { name, email, password } = body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password.' });
    }
    const normEmail = String(email).trim().toLowerCase();

    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
      } catch (e) {}
    }

    let existingUser = null;
    if (mongoose.connection.readyState === 1) {
      try { existingUser = await User.findOne({ email: normEmail }); } catch (e) {}
    }
    if (!existingUser) existingUser = inMemoryUsers.get(normEmail);

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    let userId = 'usr-' + Date.now();

    if (mongoose.connection.readyState === 1) {
      try {
        const newUser = await User.create({ name, email: normEmail, password: hashedPassword });
        userId = String(newUser._id);
      } catch (e) {
        inMemoryUsers.set(normEmail, { _id: userId, name, email: normEmail, password: hashedPassword });
      }
    } else {
      inMemoryUsers.set(normEmail, { _id: userId, name, email: normEmail, password: hashedPassword });
    }

    const token = jwt.sign({ id: userId, name, email: normEmail }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(201).json({ token, user: { id: userId, name, email: normEmail } });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
};
