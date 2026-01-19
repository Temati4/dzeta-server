const express = require('express');
const router = express.Router();
const db = require('../database/mock');
const { authMiddleware } = require('../middleware/auth');

const PROMO_CODES = {
  'DZETA50': { discount: 0.50, maxUses: 100 },
  'EARLY30': { discount: 0.30, maxUses: 50 },
  'WELCOME15': { discount: 0.15, maxUses: 1000 },
  'FUCKEDVELONITY': { discount: 0.11, maxUses: Infinity }
};

// Create payment
router.post('/create', authMiddleware, (req, res) => {
  try {
    console.log('[PAYMENT] Create payment request from user:', req.userId);
    const { planType, paymentMethod, promoCode } = req.body;
    console.log('[PAYMENT] Payment details:', { planType, paymentMethod, promoCode });

    const PLAN_PRICES = {
      monthly: 300,
      quarterly: 400,
      lifetime: 600,
      hwid_reset: 150,
      beta_access: 400
    };

    if (!planType) {
      console.log('[PAYMENT] Create failed: Plan type is missing');
      return res.status(400).json({ 
        error: 'Plan type is required',
        code: 'MISSING_PLAN_TYPE',
        details: 'Please specify which plan to purchase'
      });
    }

    if (!PLAN_PRICES[planType]) {
      console.log('[PAYMENT] Create failed: Invalid plan type:', planType);
      return res.status(400).json({ 
        error: 'Invalid plan type',
        code: 'INVALID_PLAN',
        details: `Plan type must be one of: ${Object.keys(PLAN_PRICES).join(', ')}`
      });
    }

    if (!paymentMethod) {
      console.log('[PAYMENT] Create failed: Payment method is missing');
      return res.status(400).json({ 
        error: 'Payment method is required',
        code: 'MISSING_METHOD',
        details: 'Please select a payment method (card, sbp, or crypto)'
      });
    }

    let amount = PLAN_PRICES[planType];
    let discount = 0;
    let appliedPromo = null;

    // Apply promo code
    if (promoCode) {
      const promo = PROMO_CODES[promoCode.toUpperCase()];
      if (promo) {
        discount = amount * promo.discount;
        amount = amount - discount;
        appliedPromo = promoCode.toUpperCase();
        console.log('[PAYMENT] Promo code applied:', { code: appliedPromo, discount, newAmount: amount });
      } else {
        console.log('[PAYMENT] Invalid promo code:', promoCode);
      }
    }

    const payment = db.createPayment(req.userId, amount, paymentMethod, planType);

    console.log('[PAYMENT] Payment created successfully:', payment.id);
    res.status(201).json({
      success: true,
      payment: {
        id: payment.id,
        amount: amount,
        originalAmount: amount + discount,
        discount,
        appliedPromo,
        planType,
        paymentMethod,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('[PAYMENT] Create payment error:', error.message);
    res.status(500).json({ 
      error: 'Server error while creating payment',
      code: 'PAYMENT_CREATE_ERROR',
      details: error.message
    });
  }
});

// Process payment (simulate payment gateway)
router.post('/process', authMiddleware, (req, res) => {
  try {
    console.log('[PAYMENT] Process payment request from user:', req.userId);
    const { paymentId } = req.body;
    console.log('[PAYMENT] Processing payment:', paymentId);

    if (!paymentId) {
      console.log('[PAYMENT] Process failed: Payment ID is missing');
      return res.status(400).json({ 
        error: 'Payment ID is required',
        code: 'MISSING_PAYMENT_ID',
        details: 'Please provide a valid payment ID'
      });
    }

    const payment = db.getPaymentById(paymentId);

    if (!payment) {
      console.log('[PAYMENT] Process failed: Payment not found:', paymentId);
      return res.status(404).json({ 
        error: 'Payment not found',
        code: 'PAYMENT_NOT_FOUND',
        details: 'The specified payment does not exist'
      });
    }

    if (payment.userId !== req.userId) {
      console.log('[PAYMENT] Process failed: Unauthorized access to payment:', paymentId);
      return res.status(403).json({ 
        error: 'Unauthorized',
        code: 'PAYMENT_UNAUTHORIZED',
        details: 'You do not have permission to process this payment'
      });
    }

    // Simulate payment processing
    // In production, this would call Stripe, CryptoBot API, etc.

    // Mark payment as completed
    const updatedPayment = db.updatePaymentStatus(paymentId, 'completed');

    // Create subscription
    const subscriptionRouter = require('./subscription');
    
    const PLAN_DURATIONS = {
      monthly: 30,
      quarterly: 90,
      lifetime: 36500
    };

    const subscription = db.createSubscription(
      req.userId,
      payment.planType,
      PLAN_DURATIONS[payment.planType]
    );

    res.json({
      success: true,
      payment: updatedPayment,
      subscription,
      transactionId: payment.transactionId,
      message: 'Payment processed successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment by ID
router.get('/:paymentId', authMiddleware, (req, res) => {
  try {
    const payment = db.getPaymentById(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      payment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate promo code
router.post('/validate-promo', (req, res) => {
  try {
    const { promoCode } = req.body;

    if (!promoCode) {
      return res.status(400).json({ error: 'Promo code required' });
    }

    const promo = PROMO_CODES[promoCode.toUpperCase()];

    if (!promo) {
      return res.json({
        valid: false,
        message: 'Invalid promo code'
      });
    }

    res.json({
      valid: true,
      discount: Math.round(promo.discount * 100),
      message: `Promo code ${promoCode.toUpperCase()} is valid`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
