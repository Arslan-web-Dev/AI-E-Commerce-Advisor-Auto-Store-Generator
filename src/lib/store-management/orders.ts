import { OrderStatus, OrderStatusHistoryItem } from '@/types/store-management';

/**
 * Valid state transitions for the SRS FR-8.10 order fulfillment pipeline:
 * pending → confirmed → packed → shipped → delivered
 * plus terminal or reversive branches: cancelled, returned.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

/**
 * Determines whether transitioning from currentStatus to targetStatus is valid.
 */
export function canTransitionOrder(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
  if (currentStatus === targetStatus) return false;
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

/**
 * Determines whether a status transition requires decrementing inventory stock.
 * In SRS FR-8.10: "stock is decremented on confirmation".
 */
export function shouldDecrementStockOnTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
  return currentStatus === 'pending' && targetStatus === 'confirmed';
}

/**
 * Determines whether a status transition requires restoring inventory stock.
 * Restores stock if an already confirmed or packed order is cancelled.
 */
export function shouldRestoreStockOnTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
  return (currentStatus === 'confirmed' || currentStatus === 'packed') && targetStatus === 'cancelled';
}

/**
 * Appends a new timestamped audit log entry to the order's status history.
 */
export function appendStatusHistory(
  history: OrderStatusHistoryItem[],
  newStatus: OrderStatus,
  actor: string,
  notes?: string
): OrderStatusHistoryItem[] {
  return [
    ...history,
    {
      status: newStatus,
      changed_at: new Date().toISOString(),
      actor,
      notes,
    },
  ];
}

/**
 * Returns human-friendly display label and badge styling attributes for order statuses.
 */
export function getOrderStatusMeta(status: OrderStatus): { label: string; bg: string; text: string; icon: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending Review', bg: 'rgba(217, 119, 6, 0.15)', text: '#f59e0b', icon: 'schedule' };
    case 'confirmed':
      return { label: 'Confirmed', bg: 'rgba(78, 222, 163, 0.15)', text: '#4edea3', icon: 'check_circle' };
    case 'packed':
      return { label: 'Packed & Ready', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', icon: 'inventory_2' };
    case 'shipped':
      return { label: 'Dispatched / In Transit', bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', icon: 'local_shipping' };
    case 'delivered':
      return { label: 'Delivered', bg: 'rgba(16, 185, 129, 0.2)', text: '#10b981', icon: 'task_alt' };
    case 'cancelled':
      return { label: 'Cancelled', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', icon: 'cancel' };
    case 'returned':
      return { label: 'Returned', bg: 'rgba(107, 114, 128, 0.2)', text: '#9ca3af', icon: 'replay' };
    default:
      return { label: status, bg: 'rgba(255, 255, 255, 0.1)', text: '#ffffff', icon: 'info' };
  }
}
