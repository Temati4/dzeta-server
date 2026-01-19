const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dzeta-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    console.error('[AUTH] No token provided in Authorization header');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.user = decoded;
    console.log('[AUTH] Token verified successfully for user:', decoded.id);
    next();
  } catch (err) {
    console.error('[AUTH] Token verification failed:', err.message, 'JWT_SECRET matches:', JWT_SECRET === process.env.JWT_SECRET);
    return res.status(401).json({ error: 'Invalid token', details: err.message });
  }
};

const generateToken = (userId, email) => {
  const token = jwt.sign(
    { id: userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  console.log('[AUTH] Token generated for user:', userId, '| Secret length:', JWT_SECRET.length);
  return token;
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
