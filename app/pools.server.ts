import db from "./db.server";

// Get all active pools
export async function getActivePools() {
  return db.pool.findMany({
    where: { status: "ACTIVE" },
    include: { members: true },
  });
}

// Get one pool by product ID
export async function getPoolByProduct(productId: string) {
  return db.pool.findFirst({
    where: { productId, status: "ACTIVE" },
    include: { members: true },
  });
}

// Create a new pool
export async function createPool(data: {
  productId: string;
  productTitle: string;
  targetQuantity: number;
  discountPercent: number;
  deadline?: Date;
}) {
  return db.pool.create({ data });
}

// Join a pool
export async function joinPool(data: {
  poolId: string;
  customerId: string;
  customerEmail: string;
  quantity: number;
}) {
  // Add member to pool
  await db.poolMember.create({ data });

  // Update pool total quantity
  const pool = await db.pool.update({
    where: { id: data.poolId },
    data: {
      currentQuantity: {
        increment: data.quantity,
      },
    },
    include: { members: true },
  });

  // Check if target is reached
  if (pool.currentQuantity >= pool.targetQuantity) {
    await db.pool.update({
      where: { id: data.poolId },
      data: { status: "COMPLETED" },
    });
  }

  return pool;
}

// Get all pools for admin dashboard
export async function getAllPools() {
  return db.pool.findMany({
    include: { members: true },
    orderBy: { createdAt: "desc" },
  });
}
