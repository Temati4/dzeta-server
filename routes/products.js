const express = require('express');
const router = express.Router();

// Get all products
router.get('/all', (req, res) => {
  try {
    const products = global.db.getProducts();
    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single product by ID
router.get('/:id', (req, res) => {
  try {
    const product = global.db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create product (admin only - you can add auth later)
router.post('/', (req, res) => {
  try {
    const product = global.db.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update product (admin only)
router.put('/:id', (req, res) => {
  try {
    const product = global.db.updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete product (admin only)
router.delete('/:id', (req, res) => {
  try {
    const product = global.db.deleteProduct(req.params.id);
    res.json({ message: 'Product deleted', product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
