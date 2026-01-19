const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

class MockDatabase {
  constructor() {
    this.users = new Map();
    this.subscriptions = new Map();
    this.payments = new Map();
    this.sessions = new Map();
    this.userCounter = 0; // Для инкрементального UID
    this.initializeDefault();
  }

  initializeDefault() {
    // Add sample user for testing
    const hashedPassword = bcryptjs.hashSync('password123', 10);
    this.userCounter = 1;
    this.users.set('test@dzeta.com', {
      uid: 1,
      id: 'user_001',
      email: 'test@dzeta.com',
      username: 'testuser',
      password: hashedPassword,
      createdAt: new Date(),
      subscription: null,
      role: 'user'
    });
  }

  // User operations
  createUser(email, username, password) {
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }
    
    const hashedPassword = bcryptjs.hashSync(password, 10);
    const userId = 'user_' + crypto.randomBytes(8).toString('hex');
    this.userCounter++;
    
    const user = {
      uid: this.userCounter,
      id: userId,
      email,
      username,
      password: hashedPassword,
      createdAt: new Date(),
      subscription: null,
      role: 'user'
    };
    
    this.users.set(email, user);
    return { ...user, password: undefined };
  }

  getUserByEmail(email) {
    return this.users.get(email);
  }

  getUserById(id) {
    for (const user of this.users.values()) {
      if (user.id === id) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    }
    return null;
  }

  updateUser(id, updates) {
    for (const [email, user] of this.users.entries()) {
      if (user.id === id) {
        Object.assign(user, updates);
        return { ...user, password: undefined };
      }
    }
    return null;
  }

  // Subscription operations
  createSubscription(userId, planType, durationDays) {
    const subscriptionId = 'sub_' + crypto.randomBytes(8).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const subscription = {
      id: subscriptionId,
      userId,
      planType, // 'monthly', 'quarterly', 'lifetime'
      durationDays,
      startedAt: now,
      expiresAt,
      status: 'active',
      price: { 'monthly': 29.99, 'quarterly': 79.99, 'lifetime': 199.99 }[planType]
    };

    this.subscriptions.set(subscriptionId, subscription);
    
    // Update user's subscription
    for (const user of this.users.values()) {
      if (user.id === userId) {
        user.subscription = subscriptionId;
        break;
      }
    }

    return subscription;
  }

  getSubscriptionByUserId(userId) {
    for (const sub of this.subscriptions.values()) {
      if (sub.userId === userId) {
        return sub;
      }
    }
    return null;
  }

  // Payment operations
  createPayment(userId, amount, method, planType) {
    const paymentId = 'pay_' + crypto.randomBytes(8).toString('hex');
    
    const payment = {
      id: paymentId,
      userId,
      amount,
      method, // 'card', 'sbp', 'crypto'
      planType,
      status: 'pending',
      createdAt: new Date(),
      transactionId: `txn_${crypto.randomBytes(6).toString('hex')}`,
      metadata: {
        userAgent: 'dzeta-client',
        ipAddress: '0.0.0.0'
      }
    };

    this.payments.set(paymentId, payment);
    return payment;
  }

  getPaymentById(id) {
    return this.payments.get(id);
  }

  updatePaymentStatus(paymentId, status) {
    const payment = this.payments.get(paymentId);
    if (payment) {
      payment.status = status;
      return payment;
    }
    return null;
  }

  // Session operations
  createSession(userId, token) {
    const sessionId = 'sess_' + crypto.randomBytes(8).toString('hex');
    this.sessions.set(sessionId, {
      userId,
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    return sessionId;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  // Admin-specific methods
  getAllUsers() {
    const usersArray = Array.from(this.users.values());
    return usersArray.map(u => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });
  }

  deleteUser(id) {
    for (const [email, user] of this.users.entries()) {
      if (user.id === id) {
        this.users.delete(email);
        return user;
      }
    }
    return null;
  }

  // Product operations
  getProducts() {
    // Return some default products if not defined
    if (!this.products) {
      this.products = [
        {
          id: 'preorder',
          key: 'preorder',
          name: 'Pre-order Access',
          description: 'Early access to the platform',
          price: 299,
          features: ['Full platform access', 'Early updates', 'Priority support'],
          active: true
        },
        {
          id: 'beta',
          key: 'beta',
          name: 'Beta Access',
          description: 'Access to beta features',
          price: 499,
          features: ['All preorder features', 'Beta features', 'Beta support', 'Feedback channels'],
          active: true
        }
      ];
    }
    return this.products;
  }

  getProductById(id) {
    const products = this.getProducts();
    return products.find(p => p.id === id);
  }

  createProduct(productData) {
    if (!this.products) {
      this.products = [];
    }
    const product = {
      id: productData.id || ('prod_' + Date.now()),
      key: productData.key,
      name: productData.name,
      description: productData.description,
      price: productData.price,
      features: productData.features || [],
      active: productData.active !== undefined ? productData.active : true
    };
    this.products.push(product);
    return product;
  }

  updateProduct(id, productData) {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Product not found');
    }
    this.products[index] = {
      ...this.products[index],
      ...productData
    };
    return this.products[index];
  }

  deleteProduct(id) {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Product not found');
    }
    const deleted = this.products.splice(index, 1);
    return deleted[0];
  }

  // Promo code operations
  incrementPromoUsage(codeId) {
    if (!this.promoCodes) {
      this.promoCodes = [];
    }
    const promoCode = this.promoCodes.find(p => p.id === codeId);
    
    if (!promoCode) {
      return null;
    }
    
    promoCode.usesCount = (promoCode.usesCount || 0) + 1;
    return promoCode;
  }
}

const db = new MockDatabase();
module.exports = db;
