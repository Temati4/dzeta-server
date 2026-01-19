const { Pool } = require('pg');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

// Инициализация PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'dzeta_db'
});

// Создание таблиц
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Таблица пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid INTEGER UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        subscription_id INTEGER,
        role VARCHAR(50) DEFAULT 'user'
      )
    `);

    // Таблица подписок
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_type VARCHAR(50) NOT NULL,
        duration_days INTEGER NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        price DECIMAL(10, 2) NOT NULL
      )
    `);

    // Таблица платежей
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INTEGER REFERENCES subscriptions(id),
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'RUB',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица сессий
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    // Таблица промокодов
    await client.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        discount_percent DECIMAL(5, 2),
        discount_fixed DECIMAL(10, 2),
        max_uses INTEGER,
        uses_count INTEGER DEFAULT 0,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        applied_to TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    client.release();
  }
}

class PostgresDatabase {
  async getNextUID() {
    const result = await pool.query('SELECT COALESCE(MAX(uid), 0) + 1 as next_uid FROM users');
    return result.rows[0].next_uid;
  }

  async createUser(email, username, password) {
    const client = await pool.connect();
    try {
      const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        throw new Error('User already exists');
      }

      const hashedPassword = bcryptjs.hashSync(password, 10);
      const uid = await this.getNextUID();
      const userId = 'user_' + crypto.randomBytes(8).toString('hex');

      const result = await client.query(
        'INSERT INTO users (uid, email, username, password) VALUES ($1, $2, $3, $4) RETURNING *',
        [uid, email, username, hashedPassword]
      );

      const user = result.rows[0];
      return {
        uid: user.uid,
        id: user.id,
        email: user.email,
        username: user.username
      };
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  async getUserById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    const { password, ...userWithoutPassword } = result.rows[0];
    return userWithoutPassword;
  }

  async updateUser(id, updates) {
    const client = await pool.connect();
    try {
      const fields = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');
      const values = Object.values(updates);

      const result = await client.query(
        `UPDATE users SET ${fields} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
      );

      if (!result.rows[0]) return null;
      const { password, ...userWithoutPassword } = result.rows[0];
      return userWithoutPassword;
    } finally {
      client.release();
    }
  }

  async createSubscription(userId, planType, durationDays, price) {
    const client = await pool.connect();
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const result = await client.query(
        `INSERT INTO subscriptions (user_id, plan_type, duration_days, started_at, expires_at, price)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, planType, durationDays, now, expiresAt, price]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getSubscription(subscriptionId) {
    const result = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [subscriptionId]);
    return result.rows[0] || null;
  }

  async getUserSubscription(userId) {
    const result = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
    return result.rows[0] || null;
  }

  async createPayment(userId, amount, currency = 'RUB', status = 'pending') {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO payments (user_id, amount, currency, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, amount, currency, status]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updatePaymentStatus(paymentId, status) {
    const result = await pool.query(
      'UPDATE payments SET status = $1 WHERE id = $2 RETURNING *',
      [status, paymentId]
    );
    return result.rows[0] || null;
  }

  async createSession(userId, token, expiresAt) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING *',
        [userId, token, expiresAt]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getSession(token) {
    const result = await pool.query('SELECT * FROM sessions WHERE token = $1', [token]);
    return result.rows[0] || null;
  }

  async deleteExpiredSessions() {
    await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
  }

  // Generic methods for any entity
  async find(entityType, criteria) {
    const tableMap = {
      'users': 'users',
      'subscriptions': 'subscriptions', 
      'payments': 'payments',
      'sessions': 'sessions',
      'products': 'products',
      'promoCodes': 'promo_codes'
    };
    
    const tableName = tableMap[entityType];
    if (!tableName) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    const conditions = [];
    const values = [];
    let paramIndex = 1;
    
    for (const key in criteria) {
      conditions.push(`${key} = $${paramIndex++}`);
      values.push(criteria[key]);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM ${tableName} ${whereClause} LIMIT 1`;
    
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async read() {
    // Return all data - this would be expensive in production, consider alternatives
    return {
      users: (await pool.query('SELECT * FROM users')).rows,
      subscriptions: (await pool.query('SELECT * FROM subscriptions')).rows,
      payments: (await pool.query('SELECT * FROM payments')).rows,
      sessions: (await pool.query('SELECT * FROM sessions')).rows,
      products: (await pool.query('SELECT * FROM products')).rows,
      promoCodes: (await pool.query('SELECT * FROM promo_codes')).rows
    };
  }

  async create(entityType, entityData) {
    const tableMap = {
      'users': 'users',
      'subscriptions': 'subscriptions', 
      'payments': 'payments',
      'sessions': 'sessions',
      'products': 'products',
      'promoCodes': 'promo_codes'
    };
    
    const tableName = tableMap[entityType];
    if (!tableName) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    const columns = Object.keys(entityData);
    const values = Object.values(entityData);
    
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
    const columnNames = columns.join(', ');
    
    const query = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);
    
    return result.rows[0];
  }

  async update(entityType, criteria, updates) {
    const tableMap = {
      'users': 'users',
      'subscriptions': 'subscriptions', 
      'payments': 'payments',
      'sessions': 'sessions',
      'products': 'products',
      'promoCodes': 'promo_codes'
    };
    
    const tableName = tableMap[entityType];
    if (!tableName) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    const updateFields = Object.keys(updates);
    const whereConditions = Object.keys(criteria);
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    const setParts = [];
    const values = [];
    let paramIndex = 1;
    
    // Build SET clause
    for (const field of updateFields) {
      setParts.push(`${field} = $${paramIndex++}`);
      values.push(updates[field]);
    }
    
    // Build WHERE clause
    for (const field of whereConditions) {
      values.push(criteria[field]);
      setParts.push(`${field} = $${paramIndex++}`);
    }
    
    const setClause = setParts.slice(0, updateFields.length).join(', ');
    const whereClauseStartIdx = updateFields.length;
    const whereClauseEndIdx = whereClauseStartIdx + whereConditions.length;
    const whereClause = `WHERE ${setParts.slice(whereClauseStartIdx, whereClauseEndIdx).join(' AND ')}`;
    
    const query = `UPDATE ${tableName} SET ${setClause} ${whereClause} RETURNING *`;
    
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(entityType, criteria) {
    const tableMap = {
      'users': 'users',
      'subscriptions': 'subscriptions', 
      'payments': 'payments',
      'sessions': 'sessions',
      'products': 'products',
      'promoCodes': 'promo_codes'
    };
    
    const tableName = tableMap[entityType];
    if (!tableName) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    const conditions = [];
    const values = [];
    let paramIndex = 1;
    
    for (const key in criteria) {
      conditions.push(`${key} = $${paramIndex++}`);
      values.push(criteria[key]);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `DELETE FROM ${tableName} ${whereClause} RETURNING *`;
    
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  // Promo code operations
  async incrementPromoUsage(codeId) {
    const result = await pool.query(
      `UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = $1 RETURNING *`,
      [codeId]
    );
    
    return result.rows[0] || null;
  }
}

module.exports = {
  PostgresDatabase,
  pool,
  initializeDatabase
};
