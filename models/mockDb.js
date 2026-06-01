const crypto = require('crypto');

// In-memory collections
const pools = [];
const poolMembers = [];
const procurementBatches = [];

// A thenable query class to mimic mongoose query chaining (e.g. .find().sort())
class MockQuery {
  constructor(promise) {
    this.promise = promise;
  }

  sort(sortObj) {
    this.promise = this.promise.then(items => {
      if (sortObj && typeof sortObj === 'object') {
        const key = Object.keys(sortObj)[0];
        const order = sortObj[key]; // 1 or -1
        return [...items].sort((a, b) => {
          const valA = a[key];
          const valB = b[key];
          if (valA < valB) return order === 1 ? -1 : 1;
          if (valA > valB) return order === 1 ? 1 : -1;
          return 0;
        });
      }
      return items;
    });
    return this;
  }

  then(onFulfilled, onRejected) {
    return this.promise.then(onFulfilled, onRejected);
  }
}

class MockPool {
  static async findOneAndUpdate(query, update, options = {}) {
    let pool = pools.find(p => {
      for (let key in query) {
        if (!p[key] || p[key].toString() !== query[key].toString()) return false;
      }
      return true;
    });
    
    if (!pool && options.upsert) {
      let targetQty = 100;
      if (update.$setOnInsert && update.$setOnInsert.targetQuantity !== undefined) {
        targetQty = update.$setOnInsert.targetQuantity;
      }
      pool = {
        _id: crypto.randomUUID(),
        productId: query.productId,
        targetQuantity: targetQty,
        currentQuantity: 0,
        status: 'active',
        createdAt: new Date(),
      };
      pools.push(pool);
    } else if (pool) {
      if (update.status) {
        pool.status = update.status;
      }
      if (update.completedAt) {
        pool.completedAt = update.completedAt;
      }
    }
    
    return pool ? { ...pool } : null;
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const index = pools.findIndex(p => p._id.toString() === id.toString());
    if (index === -1) return null;
    
    const pool = pools[index];
    if (update.$inc && update.$inc.currentQuantity !== undefined) {
      pool.currentQuantity += update.$inc.currentQuantity;
    }
    return { ...pool };
  }

  static async findOne(query) {
    const pool = pools.find(p => {
      for (let key in query) {
        if (!p[key] || p[key].toString() !== query[key].toString()) return false;
      }
      return true;
    });
    return pool ? { ...pool } : null;
  }

  static find(query = {}) {
    const matched = pools.filter(p => {
      for (let key in query) {
        if (!p[key] || p[key].toString() !== query[key].toString()) return false;
      }
      return true;
    }).map(p => ({ ...p }));
    
    return new MockQuery(Promise.resolve(matched));
  }

  static async create(data) {
    const pool = {
      _id: crypto.randomUUID(),
      productId: data.productId,
      targetQuantity: data.targetQuantity || 100,
      currentQuantity: data.currentQuantity || 0,
      status: data.status || 'active',
      createdAt: new Date(),
    };
    pools.push(pool);
    return { ...pool };
  }

  static async findById(id) {
    const pool = pools.find(p => p._id.toString() === id.toString());
    return pool ? { ...pool } : null;
  }
}

class MockPoolMember {
  static async findOne(query) {
    const member = poolMembers.find(m => {
      for (let key in query) {
        if (!m[key] || m[key].toString() !== query[key].toString()) return false;
      }
      return true;
    });
    return member ? { ...member } : null;
  }

  static async create(data) {
    if (data.orderId && poolMembers.some(m => m.orderId === data.orderId)) {
      const err = new Error('Duplicate key');
      err.code = 11000;
      throw err;
    }
    const member = {
      _id: crypto.randomUUID(),
      poolId: data.poolId,
      customerId: data.customerId,
      orderId: data.orderId,
      quantity: data.quantity,
      joinedAt: new Date(),
    };
    poolMembers.push(member);
    return { ...member };
  }

  static find(query = {}) {
    const matched = poolMembers.filter(m => {
      for (let key in query) {
        if (!m[key] || m[key].toString() !== query[key].toString()) return false;
      }
      return true;
    }).map(m => ({ ...m }));
    
    return new MockQuery(Promise.resolve(matched));
  }
}

class MockProcurementBatch {
  static async create(data) {
    const batch = {
      _id: crypto.randomUUID(),
      poolId: data.poolId,
      productId: data.productId,
      totalQuantity: data.totalQuantity,
      status: data.status || 'pending',
      createdAt: new Date(),
    };
    procurementBatches.push(batch);
    return { ...batch };
  }

  static find(query = {}) {
    const matched = procurementBatches.filter(b => {
      for (let key in query) {
        if (!b[key] || b[key].toString() !== query[key].toString()) return false;
      }
      return true;
    }).map(b => ({ ...b }));
    
    return new MockQuery(Promise.resolve(matched));
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const index = procurementBatches.findIndex(b => b._id.toString() === id.toString());
    if (index === -1) return null;
    
    const batch = procurementBatches[index];
    if (update.status) {
      batch.status = update.status;
    }
    return { ...batch };
  }
}

module.exports = {
  MockPool,
  MockPoolMember,
  MockProcurementBatch,
  clearAll: () => {
    pools.length = 0;
    poolMembers.length = 0;
    procurementBatches.length = 0;
  }
};
