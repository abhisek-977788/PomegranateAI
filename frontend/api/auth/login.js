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
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }
    const normEmail = String(email).trim().toLowerCase();

    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
      } catch (e) {}
    }

    let user = null;
    if (mongoose.connection.readyState === 1) {
      try { user = await User.findOne({ email: normEmail }); } catch (e) {}
    }
    if (!user) user = inMemoryUsers.get(normEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userId = String(user._id);
    const token = jwt.sign({ id: userId, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(200).json({ token, user: { id: userId, name: user.name, email: user.email } });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
};
