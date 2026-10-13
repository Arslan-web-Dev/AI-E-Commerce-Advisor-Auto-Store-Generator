import { Product, InventoryAdjustmentReason, InventoryLog } from '@/types/store-management';

/**
 * Checks if a product has fallen below or reached its low-stock threshold.
 */
export function isLowStock(product: { stock: number; low_stock_threshold: number }): boolean {
  return product.stock <= product.low_stock_threshold;
}

/**
 * Filters a list of products to identify those requiring urgent restock.
 */
export function filterLowStockProducts(products: Product[]): Product[] {
  return products.filter((p) => p.is_active && !p.is_archived && isLowStock(p));
}

export interface StockAdjustmentInput {
  productId: string;
  storeId: string;
  currentStock: number;
  newStock: number;
  reason: InventoryAdjustmentReason;
  actorId?: string | null;
}

export interface StockAdjustmentResult {
  valid: boolean;
  delta: number;
  previousStock: number;
  newStock: number;
  error?: string;
  log?: Omit<InventoryLog, 'id' | 'created_at'>;
}

/**
 * Validates and calculates an atomic stock adjustment.
 * Enforces non-negative stock invariant (no overselling/negative stock).
 */
export function calculateStockAdjustment(input: StockAdjustmentInput): StockAdjustmentResult {
  if (input.newStock < 0) {
    return {
      valid: false,
      delta: 0,
      previousStock: input.currentStock,
      newStock: input.currentStock,
      error: 'Stock quantity cannot be negative. Minimum allowed stock is 0 units.',
    };
  }

  const delta = input.newStock - input.currentStock;

  return {
    valid: true,
    delta,
    previousStock: input.currentStock,
    newStock: input.newStock,
    log: {
      store_id: input.storeId,
      product_id: input.productId,
      delta,
      previous_stock: input.currentStock,
      new_stock: input.newStock,
      reason: input.reason,
      actor_id: input.actorId || null,
    },
  };
}

/**
 * Validates whether an order's line items can be fulfilled against available stock.
 */
export function validateOrderStockAvailability(
  items: Array<{ productId: string; quantity: number }>,
  productStockMap: Map<string, number>
): { canFulfill: boolean; shortages: Array<{ productId: string; requested: number; available: number }> } {
  const shortages: Array<{ productId: string; requested: number; available: number }> = [];

  for (const item of items) {
    const available = productStockMap.get(item.productId) ?? 0;
    if (available < item.quantity) {
      shortages.push({
        productId: item.productId,
        requested: item.quantity,
        available,
      });
    }
  }

  return {
    canFulfill: shortages.length === 0,
    shortages,
  };
}
