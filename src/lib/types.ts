export type Category =
  | 'Snacks'
  | 'Drinks'
  | 'Energy'
  | 'Candy'
  | 'Frozen'
  | 'Essentials';

export interface ModifierOption {
  label: string;
  priceDelta: number;
}
export interface ModifierGroup {
  name: string;
  required: number;
  max?: number; // multi-select up to `max`; single-choice (radio) when absent
  options: ModifierOption[];
}

export interface Product {
  id: string;
  name: string;
  emoji: string;
  image: string | null; // relative path like /products/s01.jpg, or null
  price: number;
  basePrice: number;
  category: string;
  vendorId: string;
  inStock: boolean;
  modifiers: ModifierGroup[];
}

export interface AppNotification {
  id: string;
  orderId: string | null;
  title: string;
  body: string;
  read: boolean;
  at: number;
}

export interface CategoryTab {
  key: string;
  emoji: string;
}

export interface CartItem {
  productId: string;
  qty: number;
  modifier: string;
}

export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PICKING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

export const ORDER_STEPS: OrderStatus[] = [
  'PLACED',
  'ACCEPTED',
  'PICKING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export type ItemStatus = 'ok' | 'out_of_stock' | 'substituted' | 'refunded';

export interface Substitute {
  productId: string;
  name: string;
  emoji: string;
  price: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  emoji: string;
  price: number;
  qty: number;
  modifier: string;
  itemStatus: ItemStatus;
  substitute: Substitute | null;
}

// Matches the JSON returned by the backend (see server/logic.js).
export interface Order {
  id: string;
  shortId: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  smallOrderFee: number;
  tax: number;
  tip: number;
  discount: number;
  total: number;
  campusId: string;
  building: string;
  note: string;
  status: OrderStatus;
  stepIndex: number;
  etaMinutes: number;
  driveProgress: number;
  needsSubstitution: boolean;
  driverName: string | null;
  kitchenStatus: string;
  escalationLevel: number;
  dispatchLevel: number;
  receiptCaptured: boolean;
  vendorIds: string[];
  pointsEarned: number;
  pointsRedeemed: number;
  placedAt: number;
}

export interface PointsEvent {
  id: string;
  delta: number;
  reason: string;
  at: number;
}

export interface Session {
  phone: string;
  name: string;
  campusId: string;
  points: number;
  referralCode: string;
  credit: number;
  ledger: PointsEvent[];
}
