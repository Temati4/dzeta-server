const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcryptjs = require('bcryptjs');

const DATA_FILE = path.join(__dirname, 'data.json');

class JsonDatabase {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (error) {
      console.error('Error loading data.json:', error);
    }
    
    return {
      users: [],
      subscriptions: [],
      payments: [],
      sessions: [],
      userCounter: 0
    };
  }

  saveData() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving data.json:', error);
    }
  }

  // User operations
  getNextUID() {
    this.data.userCounter = (this.data.userCounter || 0) + 1;
    return this.data.userCounter;
  }

  createUser(email, username, password) {
    const existingUser = this.data.users.find(u => u.email === email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = bcryptjs.hashSync(password, 10);
    const uid = this.getNextUID();
    const userId = 'user_' + crypto.randomBytes(8).toString('hex');

    const user = {
      uid,
      id: userId,
      email,
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      subscriptionId: null,
      subscriptionStatus: 'inactive',
      subscriptionExpiresAt: null,
      role: 'user'
    };

    this.data.users.push(user);
    this.saveData();

    return {
      uid: user.uid,
      id: user.id,
      email: user.email,
      username: user.username,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt
    };
  }

  getUserByEmail(email) {
    return this.data.users.find(u => u.email === email) || null;
  }

  getUserById(id) {
    const user = this.data.users.find(u => u.id === id);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  getUserByUID(uid) {
    const user = this.data.users.find(u => u.uid === uid);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  updateUser(id, updates) {
    const userIndex = this.data.users.findIndex(u => u.id === id);
    if (userIndex === -1) return null;

    Object.assign(this.data.users[userIndex], updates);
    this.saveData();

    const { password, ...userWithoutPassword } = this.data.users[userIndex];
    return userWithoutPassword;
  }

  // Subscription operations
  createSubscription(userId, planType, durationDays, price) {
    const subscriptionId = 'sub_' + crypto.randomBytes(8).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const subscription = {
      id: subscriptionId,
      userId,
      planType,
      durationDays,
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'active',
      price
    };

    this.data.subscriptions.push(subscription);

    // Update user's subscription
    const userIndex = this.data.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.data.users[userIndex].subscriptionId = subscriptionId;
    }

    this.saveData();
    return subscription;
  }

  getSubscription(subscriptionId) {
    return this.data.subscriptions.find(s => s.id === subscriptionId) || null;
  }

  getUserSubscription(userId) {
    const subscriptions = this.data.subscriptions.filter(s => s.userId === userId);
    return subscriptions[subscriptions.length - 1] || null;
  }

  // Payment operations
  createPayment(userId, amount, currency = 'RUB', status = 'pending') {
    const paymentId = 'pay_' + crypto.randomBytes(8).toString('hex');

    const payment = {
      id: paymentId,
      userId,
      amount,
      currency,
      status,
      createdAt: new Date().toISOString()
    };

    this.data.payments.push(payment);
    this.saveData();
    return payment;
  }

  updatePaymentStatus(paymentId, status) {
    const paymentIndex = this.data.payments.findIndex(p => p.id === paymentId);
    if (paymentIndex === -1) return null;

    this.data.payments[paymentIndex].status = status;
    this.saveData();
    return this.data.payments[paymentIndex];
  }

  // Session operations
  createSession(userId, token, expiresAt) {
    const session = {
      id: 'session_' + crypto.randomBytes(8).toString('hex'),
      userId,
      token,
      expiresAt,
      createdAt: new Date().toISOString()
    };

    this.data.sessions.push(session);
    this.saveData();
    return session;
  }

  getSession(token) {
    return this.data.sessions.find(s => s.token === token) || null;
  }

  deleteExpiredSessions() {
    const now = new Date();
    this.data.sessions = this.data.sessions.filter(s => new Date(s.expiresAt) > now);
    this.saveData();
  }

  // Utility methods
  getAllUsers() {
    return this.data.users.map(u => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });
  }

  getAllSubscriptions() {
    return this.data.subscriptions;
  }

  getAllPayments() {
    return this.data.payments;
  }

  // Debug - get all data
  getAllData() {
    return {
      users: this.data.users.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      }),
      subscriptions: this.data.subscriptions,
      payments: this.data.payments,
      sessions: this.data.sessions.length,
      userCounter: this.data.userCounter
    };
  }

  // Product operations
  getProducts() {
    return this.data.products || [];
  }

  getProductById(id) {
    return (this.data.products || []).find(p => p.id === id);
  }

  createProduct(productData) {
    if (!this.data.products) {
      this.data.products = [];
    }
    const product = {
      id: productData.id,
      nameEn: productData.nameEn,
      nameRu: productData.nameRu,
      descriptionEn: productData.descriptionEn,
      descriptionRu: productData.descriptionRu,
      price: productData.price,
      durationDays: productData.durationDays
    };
    this.data.products.push(product);
    this.saveData();
    return product;
  }

  updateProduct(id, productData) {
    const index = (this.data.products || []).findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Product not found');
    }
    this.data.products[index] = {
      ...this.data.products[index],
      ...productData
    };
    this.saveData();
    return this.data.products[index];
  }

  deleteProduct(id) {
    const index = (this.data.products || []).findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Product not found');
    }
    const deleted = this.data.products.splice(index, 1);
    this.saveData();
    return deleted[0];
  }

  // Generic methods for any entity
  find(entityType, criteria) {
    const collection = this.data[entityType] || [];
    if (!criteria || typeof criteria !== 'object') {
      return collection;
    }

    // Find item that matches all criteria properties
    return collection.find(item => {
      for (const key in criteria) {
        if (item[key] !== criteria[key]) {
          return false;
        }
      }
      return true;
    }) || null;
  }

  read() {
    return this.data;
  }

  create(entityType, entityData) {
    if (!this.data[entityType]) {
      this.data[entityType] = [];
    }

    const collection = this.data[entityType];
    collection.push(entityData);
    this.saveData();
    return entityData;
  }

  update(entityType, criteria, updates) {
    const collection = this.data[entityType] || [];
    const index = collection.findIndex(item => {
      for (const key in criteria) {
        if (item[key] !== criteria[key]) {
          return false;
        }
      }
      return true;
    });

    if (index === -1) {
      return null;
    }

    Object.assign(collection[index], updates);
    this.saveData();
    return collection[index];
  }

  delete(entityType, criteria) {
    const collection = this.data[entityType] || [];
    const initialLength = collection.length;
    
    const index = collection.findIndex(item => {
      for (const key in criteria) {
        if (item[key] !== criteria[key]) {
          return false;
        }
      }
      return true;
    });

    if (index !== -1) {
      const deletedItems = collection.splice(index, 1);
      if (collection.length !== initialLength) {
        this.saveData();
        return deletedItems[0];
      }
    }

    return null;
  }

  // Promo code operations
  incrementPromoUsage(codeId) {
    const promoCodes = this.data.promoCodes || [];
    const promoCode = promoCodes.find(p => p.id === codeId);
    
    if (!promoCode) {
      return null;
    }
    
    promoCode.usesCount = (promoCode.usesCount || 0) + 1;
    this.saveData();
    return promoCode;
  }
}

module.exports = JsonDatabase;
