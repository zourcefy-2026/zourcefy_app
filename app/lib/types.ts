/**
 * Shared domain types for the Zourcefy Group Buy Pool feature.
 * Imported by admin routes and server utilities to avoid duplication.
 */

export interface PoolTier {
  id?: string;
  targetQuantity: number;
  discountPercent: number;
  tierOrder?: number;
}

export interface PoolMember {
  id?: string;
  customerEmail: string;
  customerId: string;
  quantity: number;
  joinedAt: string | Date;
}

export interface PoolItem {
  id: string;
  productId: string;
  productTitle: string;
  targetQuantity: number;
  currentQuantity: number;
  discountPercent: number;
  status: string;
  createdBy?: string;
  creatorEmail?: string | null;
  creatorCustomerId?: string | null;
  deadline?: string | Date | null;
  discountCode?: string | null;
  discountCodeId?: string | null;
  members: PoolMember[];
  tiers: PoolTier[];
}
