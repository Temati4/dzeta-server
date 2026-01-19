const express = require('express');
const router = express.Router();
const db = require('../database/mock');
const { authMiddleware } = require('../middleware/auth');

const PLANS = {
  monthly: {
    name: '30 Days',
    price: 300,
    durationDays: 30,
    features: [
      'Full access to all tools',
      'Priority support',
      'Advanced analytics',
      'Cloud storage'
    ]
  },
  quarterly: {
    name: '90 Days',
    price: 400,
    durationDays: 90,
    features: [
      'Everything in Monthly',
      'Team collaboration',
      'Custom integrations',
      'API access'
    ]
  },
  lifetime: {
    name: 'Lifetime',
    price: 600,
    durationDays: 36500,
    features: [
      'Everything in Quarterly',
      'Lifetime updates',
      'Dedicated support',
      'White label options'
    ]
  },
  hwid_reset: {
    name: 'Reset HWID',
    price: 150,
    durationDays: 0,
    features: ['One-time HWID reset service']
  },
  beta_access: {
    name: 'Beta Access',
    price: 400,
    durationDays: 90,
    features: [
      'Early access to beta features',
      'Exclusive beta community',
      'Direct feedback channel',
      'Special beta badge'
    ]
  }
};

// Get available plans
router.get('/plans', (req, res) => {
  try {
    res.json({
      success: true,
      plans: PLANS
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's current subscription
router.get('/current', authMiddleware, (req, res) => {
  try {
    const subscription = db.getSubscriptionByUserId(req.userId);

    if (!subscription) {
      return res.json({
        success: true,
        subscription: null
      });
    }

    const isActive = new Date() < new Date(subscription.expiresAt);

    res.json({
      success: true,
      subscription: {
        ...subscription,
        isActive,
        daysRemaining: Math.ceil((new Date(subscription.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create subscription (after payment)
router.post('/create', authMiddleware, (req, res) => {
  try {
    const { planType } = req.body;

    if (!PLANS[planType]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Check if user already has active subscription
    const existingSub = db.getSubscriptionByUserId(req.userId);
    if (existingSub && new Date() < new Date(existingSub.expiresAt)) {
      return res.status(400).json({ error: 'User already has active subscription' });
    }

    const plan = PLANS[planType];
    const subscription = db.createSubscription(req.userId, planType, plan.durationDays);

    res.status(201).json({
      success: true,
      subscription
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
