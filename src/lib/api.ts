import { API_BASE } from './config';
import { AppNotification, ModifierGroup, Order, Session } from './types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
  }
}

let token: string | null = null;
export function setToken(t: string | null) {
  token = t;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error || 'error');
  }
  return res.json() as Promise<T>;
}

interface Catalog {
  categories: { key: string; emoji: string }[];
  markup: number;
  products: {
    id: string;
    name: string;
    emoji: string;
    image: string | null;
    price: number;
    basePrice: number;
    category: string;
    vendorId: string;
    inStock: boolean;
    modifiers: ModifierGroup[];
  }[];
}

interface PlaceOrderBody {
  items: { productId: string; qty: number; modifier: string }[];
  building: string;
  note: string;
  tip: number;
  redeemPoints: boolean;
}

export const api = {
  catalog: () => req<Catalog>('/api/catalog'),
  requestCode: (phone: string) =>
    req<{ ok: boolean; devHint?: string }>('/api/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verify: (phone: string, code: string, campusId: string) =>
    req<{ token: string; session: Session }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code, campusId }),
    }),
  // Exchange a verified Firebase ID token for a Blink session. The backend
  // verifies the token's signature against Google's public keys.
  verifyFirebase: (idToken: string, campusId: string) =>
    req<{ token: string; session: Session }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken, campusId }),
    }),
  me: () => req<Session>('/api/me'),
  orders: () => req<Order[]>('/api/orders'),
  order: (id: string) => req<Order>(`/api/orders/${id}`),
  placeOrder: (body: PlaceOrderBody) =>
    req<{ order: Order; session: Session }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  resolveItem: (
    orderId: string,
    itemId: string,
    choice: { substituteProductId?: string; refund?: boolean }
  ) =>
    req<Order>(`/api/orders/${orderId}/items/${itemId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(choice),
    }),
  notifications: () => req<AppNotification[]>('/api/notifications'),
  markNotificationsRead: () =>
    req<AppNotification[]>('/api/notifications/read', { method: 'POST' }),
  bundles: () => req<Bundle[]>('/api/bundles'),
  stats: (campus = 'unl') => req<WeekStats>(`/api/stats?campus=${campus}`),
  applyReferral: (code: string) =>
    req<{ ok: boolean; session: Session }>('/api/referral/apply', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  groupCreate: (building: string) =>
    req<GroupCart>('/api/group', { method: 'POST', body: JSON.stringify({ building }) }),
  group: (code: string) => req<GroupCart>(`/api/group/${code}`),
  groupAdd: (code: string, productId: string, qty: number) =>
    req<GroupCart>(`/api/group/${code}/add`, { method: 'POST', body: JSON.stringify({ productId, qty }) }),
  groupCheckout: (code: string, body: { building: string; tip: number }) =>
    req<{ order: Order; session: Session }>(`/api/group/${code}/checkout`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  paymentsConfig: () => req<{ enabled: boolean; publishableKey: string }>('/api/payments/config'),
  checkout: (orderId: string) =>
    req<{ enabled: boolean; url?: string; error?: string }>(`/api/orders/${orderId}/checkout`, {
      method: 'POST',
    }),
  confirmPayment: (orderId: string) =>
    req<{ paid: boolean }>(`/api/orders/${orderId}/confirm`, { method: 'POST' }),
  registerPush: (token: string) =>
    req<{ ok: boolean }>('/api/push/register', { method: 'POST', body: JSON.stringify({ token }) }),
  campuses: () =>
    req<
      {
        id: string;
        short: string;
        store: LatLng;
        center: LatLng;
        buildings: { name: string; lat: number; lng: number }[];
      }[]
    >('/api/campuses'),
  geofence: (lat: number, lng: number, campus = 'unl') =>
    req<{ inside: boolean }>(`/api/geofence?campus=${campus}&lat=${lat}&lng=${lng}`),
  orderRoute: (orderId: string) => req<RouteResult>(`/api/orders/${orderId}/route`),
};

export interface LatLng {
  lat: number;
  lng: number;
}
export interface RouteResult {
  store: LatLng;
  drop: LatLng;
  coordinates: [number, number][];
  durationMin: number;
  distanceKm: number;
  source: string;
}

export interface Bundle {
  id: string;
  name: string;
  emoji: string;
  productIds: string[];
  items: { id: string; name: string; emoji: string; price: number }[];
  total: number;
}

export interface WeekStats {
  ordersThisWeek: number;
  leaderboard: { building: string; orders: number }[];
}

export interface GroupItem {
  id: string;
  productId: string;
  name: string;
  emoji: string;
  price: number;
  qty: number;
  who: string;
  lineTotal: number;
}

export interface GroupCart {
  id: string;
  code: string;
  hostId: string;
  building: string;
  status: string;
  orderId: string | null;
  items: GroupItem[];
  subtotal: number;
  freeDeliveryThreshold: number;
  toFreeDelivery: number;
  unlocked: boolean;
  people: string[];
}
