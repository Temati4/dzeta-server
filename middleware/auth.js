const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dzeta-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const generateToken = (userId, email) => {
  return jwt.sign(
    { id: userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

const hashPassword = (password) => {
  return bcryptjs.hashSync(password, 10);
};

const comparePasswords = (password, hash) => {
  return bcryptjs.compareSync(password, hash);
};

module.exports = {
  authMiddleware,
  generateToken,
  hashPassword,
  comparePasswords,
  JWT_SECRET,
  JWT_EXPIRY
};
