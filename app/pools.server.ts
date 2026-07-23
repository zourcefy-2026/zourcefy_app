import db from "./db.server";

export interface TierInput {
  targetQuantity: number;
  discountPercent: number;
  tierOrder?: number;
}

// Get all active pools
export async function getActivePools() {
  return db.pool.findMany({
    where: { status: "ACTIVE" },
    include: {
      members: true,
      tiers: { orderBy: { tierOrder: "asc" } },
    },
  });
}

// Get pool by product ID (with creator-pending checking)
export async function getPoolByProduct(
  productId: string,
  requesterEmail?: string,
  requesterCustomerId?: string
) {
  // Find active pool for this product
  const activePool = await db.pool.findFirst({
    where: { productId, status: "ACTIVE" },
    include: {
      members: true,
      tiers: { orderBy: { tierOrder: "asc" } },
    },
  });

  // Find pending pool for this product
  const pendingPool = await db.pool.findFirst({
    where: { productId, status: "PENDING" },
    include: {
      members: true,
      tiers: { orderBy: { tierOrder: "asc" } },
    },
  });

  let isCreatorPending = false;
  if (pendingPool) {
    if (
      (requesterEmail && pendingPool.creatorEmail === requesterEmail) ||
      (requesterCustomerId && pendingPool.creatorCustomerId === requesterCustomerId)
    ) {
      isCreatorPending = true;
    }
  }

  return {
    activePool,
    pendingPool: isCreatorPending ? pendingPool : null,
    isCreatorPending,
  };
}

// Create a new pool
export async function createPool(data: {
  productId: string;
  productTitle: string;
  targetQuantity: number;
  discountPercent?: number;
  status?: string;
  createdBy?: string;
  creatorEmail?: string;
  creatorCustomerId?: string;
  deadline?: Date;
  tiers?: TierInput[];
}) {
  const {
    productId,
    productTitle,
    targetQuantity,
    discountPercent = 0,
    status = "PENDING",
    createdBy = "CUSTOMER",
    creatorEmail,
    creatorCustomerId,
    deadline,
    tiers = [],
  } = data;

  const initialDiscount =
    tiers.length > 0 ? tiers[0].discountPercent : discountPercent;

  return db.pool.create({
    data: {
      productId,
      productTitle,
      targetQuantity,
      discountPercent: initialDiscount,
      status,
      createdBy,
      creatorEmail,
      creatorCustomerId,
      deadline,
      tiers: {
        create: tiers.map((t, idx) => ({
          targetQuantity: t.targetQuantity,
          discountPercent: t.discountPercent,
          tierOrder: t.tierOrder ?? idx + 1,
        })),
      },
    },
    include: {
      members: true,
      tiers: { orderBy: { tierOrder: "asc" } },
    },
  });
}

// Approve a pending pool and assign its discount tiers
export async function approvePool(
  poolId: string,
  tiers: TierInput[]
) {
  if (!tiers || tiers.length === 0) {
    throw new Error("At least one discount tier is required to approve a pool.");
  }

  // Clear any existing tiers
  await db.poolTier.deleteMany({ where: { poolId } });

  // Calculate highest tier target as the pool target quantity
  const maxTarget = Math.max(...tiers.map((t) => t.targetQuantity));
  const initialDiscount = tiers[0].discountPercent;

  return db.pool.update({
    where: { id: poolId },
    data: {
      status: "ACTIVE",
      targetQuantity: maxTarget,
      discountPercent: initialDiscount,
      tiers: {
        create: tiers.map((t, idx) => ({
          targetQuantity: t.targetQuantity,
          discountPercent: t.discountPercent,
          tierOrder: t.tierOrder ?? idx + 1,
        })),
      },
    },
    include: {
      members: true,
      tiers: { orderBy: { tierOrder: "asc" } },
    },
  });
}

// Reject a pool
export async function rejectPool(poolId: string) {
  return db.pool.update({
    where: { id: poolId },
    data: { status: "REJECTED" },
  });
}

// Update a pool and optionally replace its tiers (Admin Access)
export async function updatePool(
  poolId: string,
  data: {
    productTitle?: string;
    targetQuantity?: number;
    discountPercent?: number;
    status?: string;
    deadline?: Date;
  },
  tiers?: TierInput[]
) {
  if (tiers && tiers.length > 0) {
    await db.poolTier.deleteMany({ where: { poolId } });
    await db.poolTier.createMany({
      data: tiers.map((t, idx) => ({
        poolId,
        targetQuantity: t.targetQuantity,
        discountPercent: t.discountPercent,
        tierOrder: t.tierOrder ?? idx + 1,
      })),
    });
  }

  return db.pool.update({
    where: { id: poolId },
    data,
    include: {
      members: true,
      tiers: { orderBy: { tierOrder: "asc" } },
    },
  });
}

// Delete a pool (Admin Access)
export async function deletePool(poolId: string) {
  return db.pool.delete({
    where: { id: poolId },
  });
}

// Join a pool & re-calculate tier status
export async function joinPool(data: {
  poolId: string;
  customerId: string;
  customerEmail: string;
  quantity: number;
}) {
  // Add member to pool
  await db.poolMember.create({ data });

  // Update pool total quantity
  let pool = await db.pool.update({
    where: { id: data.poolId },
    data: {
      currentQuantity: {
        increment: data.quantity,
      },
    },
    include: {
      members: true,
      tiers: { orderBy: { tierOrder: "asc" } },
    },
  });

  // Calculate current tier discount based on currentQuantity
  let activeDiscount = pool.discountPercent;
  if (pool.tiers && pool.tiers.length > 0) {
    // Find highest unlocked tier
    const unlockedTiers = pool.tiers.filter(
      (t) => pool.currentQuantity >= t.targetQuantity
    );
    if (unlockedTiers.length > 0) {
      // Pick the tier with the highest target reached
      const currentTier = unlockedTiers[unlockedTiers.length - 1];
      activeDiscount = currentTier.discountPercent;
    }
  }

  // Check if target is reached
  const maxTarget = pool.targetQuantity;
  const isCompleted = pool.currentQuantity >= maxTarget;

  pool = await db.pool.update({
    where: { id: data.poolId },
    data: {
      discountPercent: activeDiscount,
      status: isCompleted ? "COMPLETED" : pool.status,
    },
    include: {
      members: true,
      tiers: { orderBy: { tierOrder: "asc" } },
    },
  });

  return pool;
}

// Get all pools for admin dashboard
export async function getAllPools() {
  return db.pool.findMany({
    include: {
      members: true,
      tiers: { orderBy: { tierOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}
