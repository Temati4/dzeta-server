const express = require('express');
const router = express.Router();

// Verify promo code
router.post('/verify', (req, res) => {
  const { code, productId } = req.body;

  if (!code || !productId) {
    return res.status(400).json({ error: 'Code and productId are required' });
  }

  const promoCode = global.db.find('promoCodes', { code: code.toUpperCase() });

  if (!promoCode) {
    return res.status(404).json({ error: 'Invalid promo code' });
  }

  if (!promoCode.isActive) {
    return res.status(400).json({ error: 'Promo code is not active' });
  }

  if (promoCode.expiresAt && new Date(promoCode.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'Promo code has expired' });
  }

  if (promoCode.maxUses && promoCode.usesCount >= promoCode.maxUses) {
    return res.status(400).json({ error: 'Promo code usage limit reached' });
  }

  if (!promoCode.appliedTo.includes(productId)) {
    return res.status(400).json({ error: 'Promo code is not applicable to this product' });
  }

  // Calculate discount
  let discount = 0;
  if (promoCode.discountPercent) {
    const product = global.db.find('products', { id: productId });
    if (product) {
      discount = (product.price * promoCode.discountPercent) / 100;
    }
  } else if (promoCode.discountFixed) {
    discount = promoCode.discountFixed;
  }

  // Increment usage count
  global.db.incrementPromoUsage(promoCode.id);

  res.json({
    valid: true,
    discount: discount,
    discountPercent: promoCode.discountPercent,
    discountFixed: promoCode.discountFixed,
    message: `Promo code "${code}" applied successfully`
  });
});

// Get all active promo codes (admin)
router.get('/all', (req, res) => {
  const promoCodes = global.db.read().promoCodes || [];
  res.json(promoCodes);
});

// Create new promo code (admin)
router.post('/create', (req, res) => {
  const { code, discountPercent, discountFixed, maxUses, expiresAt, appliedTo } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  if (!discountPercent && !discountFixed) {
    return res.status(400).json({ error: 'Either discountPercent or discountFixed must be provided' });
  }

  const newPromoCode = {
    id: `promo_${Date.now()}`,
    code: code.toUpperCase(),
    discountPercent: discountPercent || null,
    discountFixed: discountFixed || null,
    maxUses: maxUses || null,
    usesCount: 0,
    expiresAt: expiresAt || null,
    isActive: true,
    appliedTo: appliedTo || ['preorder', 'beta'],
    createdAt: new Date().toISOString()
  };

  global.db.create('promoCodes', newPromoCode);
  res.status(201).json(newPromoCode);
});

// Update promo code (admin)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const promoCode = global.db.find('promoCodes', { id });
  if (!promoCode) {
    return res.status(404).json({ error: 'Promo code not found' });
  }

  const updatedPromoCode = global.db.update('promoCodes', { id }, updates);
  res.json(updatedPromoCode);
});

// Delete promo code (admin)
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const deleted = global.db.delete('promoCodes', { id });
  if (deleted) {
    res.json({ message: 'Promo code deleted successfully' });
  } else {
    res.status(404).json({ error: 'Promo code not found' });
  }
});

module.exports = router;