const express = require('express');
const router = express.Router();
const { generateToken, comparePasswords, hashPassword, authMiddleware } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    console.log('[AUTH] Register request received:', { email: req.body.email, username: req.body.username });
    const { email, username, password, confirmPassword } = req.body;

    // Validation with detailed errors
    if (!email) {
      console.log('[AUTH] Register validation failed: Email is missing');
      return res.status(400).json({ 
        error: 'Email is required',
        code: 'MISSING_EMAIL',
        details: 'Please provide your email address'
      });
    }

    if (!username) {
      console.log('[AUTH] Register validation failed: Username is missing');
      return res.status(400).json({ 
        error: 'Username is required',
        code: 'MISSING_USERNAME',
        details: 'Please provide a username'
      });
    }

    if (!password) {
      console.log('[AUTH] Register validation failed: Password is missing');
      return res.status(400).json({ 
        error: 'Password is required',
        code: 'MISSING_PASSWORD',
        details: 'Please provide a password'
      });
    }

    if (!confirmPassword) {
      console.log('[AUTH] Register validation failed: Password confirmation is missing');
      return res.status(400).json({ 
        error: 'Password confirmation is required',
        code: 'MISSING_CONFIRM_PASSWORD',
        details: 'Please confirm your password'
      });
    }

    if (password !== confirmPassword) {
      console.log('[AUTH] Register validation failed: Passwords do not match');
      return res.status(400).json({ 
        error: 'Passwords do not match',
        code: 'PASSWORD_MISMATCH',
        details: 'The passwords you entered do not match'
      });
    }

    if (password.length < 6) {
      console.log('[AUTH] Register validation failed: Password too short');
      return res.status(400).json({ 
        error: 'Password is too short',
        code: 'PASSWORD_TOO_SHORT',
        details: 'Password must be at least 6 characters long'
      });
    }

    if (!email.includes('@') || !email.includes('.')) {
      console.log('[AUTH] Register validation failed: Invalid email format');
      return res.status(400).json({ 
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
        details: 'Please provide a valid email address (example@domain.com)'
      });
    }

    // Check if user exists
    const existingUser = global.db.getUserByEmail(email);
    if (existingUser) {
      console.log('[AUTH] Register validation failed: User already exists:', email);
      return res.status(409).json({ 
        error: 'User already exists',
        code: 'USER_EXISTS',
        details: 'An account with this email already exists. Try logging in instead.'
      });
    }

    // Create user
    console.log('[AUTH] Creating new user:', { email, username });
    const user = global.db.createUser(email, username, password);
    const token = generateToken(user.id, user.email);

    console.log('[AUTH] User created successfully:', user.id);
    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        username: user.username,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      },
      token,
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('[AUTH] Register error:', error.message, error.stack);
    res.status(500).json({ 
      error: 'Server error during registration',
      code: 'REGISTER_ERROR',
      details: error.message,
      message: 'Something went wrong while creating your account. Please try again.'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('[AUTH] Login request received:', { email: req.body.email });
    const { email, password } = req.body;

    if (!email) {
      console.log('[AUTH] Login validation failed: Email is missing');
      return res.status(400).json({ 
        error: 'Email is required',
        code: 'MISSING_EMAIL',
        details: 'Please provide your email address'
      });
    }

    if (!password) {
      console.log('[AUTH] Login validation failed: Password is missing');
      return res.status(400).json({ 
        error: 'Password is required',
        code: 'MISSING_PASSWORD',
        details: 'Please provide your password'
      });
    }

    const user = global.db.getUserByEmail(email);
    
    if (!user) {
      console.log('[AUTH] Login failed: User not found:', email);
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        details: 'The email or password is incorrect'
      });
    }

    const passwordMatch = comparePasswords(password, user.password);
    
    if (!passwordMatch) {
      console.log('[AUTH] Login failed: Password mismatch for:', email);
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        details: 'The email or password is incorrect'
      });
    }

    const token = generateToken(user.id, user.email);
    const { password: _, ...userWithoutPassword } = user;

    console.log('[AUTH] Login successful:', user.id);
    res.json({
      success: true,
      user: userWithoutPassword,
      token,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error.message, error.stack);
    res.status(500).json({ 
      error: 'Server error during login',
      code: 'LOGIN_ERROR',
      details: error.message,
      message: 'Something went wrong while logging in. Please try again.'
    });
  }
});

// Verify token
router.post('/verify', (req, res) => {
  try {
    console.log('[AUTH] Verify token request');
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('[AUTH] Verify failed: No token provided');
      return res.status(401).json({ 
        error: 'No token provided',
        code: 'MISSING_TOKEN',
        details: 'Authentication token is required'
      });
    }

    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = global.db.getUserById(decoded.id);

    if (!user) {
      console.log('[AUTH] Verify failed: User not found');
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        details: 'The user associated with this token no longer exists'
      });
    }

    console.log('[AUTH] Token verified successfully:', user.id);
    res.json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username },
      valid: true
    });
  } catch (error) {
    console.error('[AUTH] Verify error:', error.message);
    res.status(401).json({ 
      error: 'Token invalid or expired',
      code: 'INVALID_TOKEN',
      details: 'The token is invalid or has expired. Please log in again.'
    });
  }
});

// Change password
router.post('/change-password', (req, res) => {
  try {
    console.log('[AUTH] Change password request');
    const token = req.headers.authorization?.split(' ')[1];
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!token) {
      console.log('[AUTH] Change password failed: No token provided');
      return res.status(401).json({ 
        error: 'No token provided',
        code: 'MISSING_TOKEN',
        details: 'You must be logged in to change your password'
      });
    }

    if (!currentPassword) {
      console.log('[AUTH] Change password failed: Current password missing');
      return res.status(400).json({ 
        error: 'Current password is required',
        code: 'MISSING_CURRENT_PASSWORD',
        details: 'Please provide your current password'
      });
    }

    if (!newPassword) {
      console.log('[AUTH] Change password failed: New password missing');
      return res.status(400).json({ 
        error: 'New password is required',
        code: 'MISSING_NEW_PASSWORD',
        details: 'Please provide a new password'
      });
    }

    if (!confirmPassword) {
      console.log('[AUTH] Change password failed: Confirm password missing');
      return res.status(400).json({ 
        error: 'Password confirmation is required',
        code: 'MISSING_CONFIRM_PASSWORD',
        details: 'Please confirm your new password'
      });
    }

    if (newPassword !== confirmPassword) {
      console.log('[AUTH] Change password failed: New passwords do not match');
      return res.status(400).json({ 
        error: 'New passwords do not match',
        code: 'PASSWORD_MISMATCH',
        details: 'The new passwords you entered do not match'
      });
    }

    if (newPassword.length < 6) {
      console.log('[AUTH] Change password failed: New password too short');
      return res.status(400).json({ 
        error: 'Password is too short',
        code: 'PASSWORD_TOO_SHORT',
        details: 'New password must be at least 6 characters long'
      });
    }

    const jwt = require('jsonwebtoken');
    const { JWT_SECRET, comparePasswords } = require('../middleware/auth');
    const bcryptjs = require('bcryptjs');
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = global.db.getUserByEmail(decoded.email);

    if (!user) {
      console.log('[AUTH] Change password failed: User not found');
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        details: 'Your user account no longer exists'
      });
    }

    if (!comparePasswords(currentPassword, user.password)) {
      console.log('[AUTH] Change password failed: Current password incorrect');
      return res.status(401).json({ 
        error: 'Current password is incorrect',
        code: 'WRONG_PASSWORD',
        details: 'The current password you entered is incorrect'
      });
    }

    const hashedPassword = bcryptjs.hashSync(newPassword, 10);
    global.db.updateUser(user.id, { password: hashedPassword });

    console.log('[AUTH] Password changed successfully:', user.id);
    res.json({ 
      success: true, 
      message: 'Password changed successfully',
      code: 'PASSWORD_CHANGED'
    });
  } catch (error) {
    console.error('[AUTH] Change password error:', error.message);
    res.status(500).json({ 
      error: 'Server error while changing password',
      code: 'CHANGE_PASSWORD_ERROR',
      details: error.message,
      message: 'Something went wrong while changing your password'
    });
  }
});

module.exports = router;
