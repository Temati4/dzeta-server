const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// Get user profile
router.get('/profile', authMiddleware, (req, res) => {
  try {
    console.log('[USER] Fetching profile for user:', req.userId);
    const user = global.db.getUserById(req.userId);

    if (!user) {
      console.log('[USER] User not found:', req.userId);
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        details: 'The user account does not exist'
      });
    }

    let subscription = null;
    if (user.subscriptionId) {
      subscription = global.db.getSubscription(user.subscriptionId);
    }

    console.log('[USER] Profile fetched successfully:', user.id);
    res.json({
      success: true,
      user: {
        uid: user.uid,
        id: user.id,
        email: user.email,
        username: user.username,
        subscription
      }
    });
  } catch (error) {
    console.error('[USER] Profile fetch error:', error.message);
    res.status(500).json({ 
      error: 'Server error while fetching profile',
      code: 'PROFILE_ERROR',
      details: error.message
    });
  }
});

// Update profile
router.put('/profile', authMiddleware, (req, res) => {
  try {
    console.log('[USER] Updating profile for user:', req.userId);
    const { username } = req.body;

    if (!username) {
      console.log('[USER] Update failed: Username is missing');
      return res.status(400).json({ 
        error: 'Username is required',
        code: 'MISSING_USERNAME',
        details: 'Please provide a username'
      });
    }

    const updatedUser = global.db.updateUser(req.userId, { username });

    console.log('[USER] Profile updated successfully:', req.userId);
    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('[USER] Profile update error:', error.message);
    res.status(500).json({ 
      error: 'Server error while updating profile',
      code: 'UPDATE_ERROR',
      details: error.message
    });
  }
});

// Get payment history
router.get('/payments', authMiddleware, (req, res) => {
  try {
    const payments = global.db.getAllPayments()
      .filter(p => p.userId === req.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      payments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
