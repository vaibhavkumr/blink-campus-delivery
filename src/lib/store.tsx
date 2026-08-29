import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, ApiError, Bundle, setToken, WeekStats } from './api';
import { firebaseEnabled } from './firebaseConfig';
import { pushLocal, registerForPush } from './notify';
import { AppNotification, CartItem, CategoryTab, Order, Product, Session } from './types';

// Pricing constants — kept in sync with server/config.js. The server is
// authoritative for real totals; these only power the cart's live preview.
export const DELIVERY_FEE = 2.99;
export const SERVICE_FEE = 0.99;
export const SMALL_ORDER_THRESHOLD = 8.0;
export const SMALL_ORDER_FEE = 1.99;
export const FREE_DELIVERY_THRESHOLD = 15.0;
export const TAX_RATE = 0.075;
export const REDEEM_POINTS = 100;
export const REDEEM_VALUE = 5;
export const DEV_OTP = '123456';

interface PlaceOrderInput {
  campusId: string;
  building: string;
  note: string;
  tip: number;
  redeemPoints: boolean;
}

// Unit price for a cart line = product price (base + markup) plus the sum of
// every selected modifier's delta. A build-your-own selection is encoded as
// "Label A · Label B · …". Mirrors server/logic.js createOrder.
export function unitPrice(product: Product, modifier: string): number {
  let delta = 0;
  if (modifier) {
    for (const part of modifier.split(' · ').map((s) => s.trim()).filter(Boolean)) {
      for (const g of product.modifiers) {
        const opt = g.options.find((o) => o.label === part);
        if (opt) {
          delta += opt.priceDelta / 100;
          break;
        }
      }
    }
  }
  return product.price + delta;
}

interface AppState {
  ready: boolean;
  session: Session | null;
  products: Product[];
  categories: CategoryTab[];
  markup: number;
  cart: CartItem[];
  orders: Order[];
  notifications: AppNotification[];
  unreadCount: number;
  catalogError: boolean;
  productById: (id: string) => Product | undefined;
  sendCode: (phone: string) => Promise<void>;
  verifyCode: (phone: string, code: string, campusId: string) => Promise<boolean>;
  verifyFirebaseToken: (idToken: string, campusId: string) => Promise<boolean>;
  firebaseEnabled: boolean;
  signOut: () => void;
  setQty: (productId: string, qty: number, modifier?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  placeOrder: (input: PlaceOrderInput) => Promise<Order | null>;
  resolveItem: (
    orderId: string,
    itemId: string,
    choice: { substituteProductId?: string; refund?: boolean }
  ) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  bundles: Bundle[];
  stats: WeekStats | null;
  addBundle: (bundle: Bundle) => void;
  applyReferralCode: (code: string) => Promise<boolean>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryTab[]>([]);
  const [markup, setMarkup] = useState(0.5);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [stats, setStats] = useState<WeekStats | null>(null);
  const loggedIn = useRef(false);
  const seenNotif = useRef<Set<string>>(new Set());
  const pushRegistered = useRef(false);
  const [catalogError, setCatalogError] = useState(false);

  // Load the catalog once at startup (public endpoint). Demo mode keeps no
  // persisted session, so every launch begins at the sign-in screen.
  const loadCatalog = useCallback(async () => {
    try {
      const { products: p, categories: c, markup: mk } = await api.catalog();
      setProducts(p);
      setCategories(c);
      setMarkup(mk);
      setCatalogError(false);
    } catch {
      setCatalogError(true);
    } finally {
      setReady(true);
    }
    // Growth surfaces — best-effort, non-blocking.
    api.bundles().then(setBundles).catch(() => {});
    api.stats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Poll for live order status + points while signed in.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [me, os, ns] = await Promise.all([api.me(), api.orders(), api.notifications()]);
        if (cancelled) return;
        setSession(me);
        setOrders(os);
        setNotifications(ns);
        // Fire an on-device local notification for any event we haven't
        // surfaced yet (skips the initial backlog on first load).
        if (seenNotif.current.size === 0) {
          ns.forEach((n) => seenNotif.current.add(n.id));
        } else {
          for (const n of [...ns].reverse()) {
            if (!seenNotif.current.has(n.id)) {
              seenNotif.current.add(n.id);
              // Remote push (registered) already delivers these — only fire a
              // local one when remote push isn't available (e.g. Expo Go/web).
              if (!pushRegistered.current) pushLocal(n.title, n.body);
            }
          }
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401 && !cancelled) {
          // token invalid/expired — drop to sign-in
          setToken(null);
          setSession(null);
        }
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [session]);

  const productById = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products]
  );

  const sendCode = useCallback(async (phone: string) => {
    await api.requestCode(phone);
  }, []);

  // Shared post-verification work: store the session token, load orders, and
  // register for push. Used by both the OTP and Firebase sign-in paths.
  const finishLogin = useCallback(async (token: string, s: Session) => {
    setToken(token);
    setSession(s);
    loggedIn.current = true;
    try {
      setOrders(await api.orders());
    } catch {
      // orders load can retry on next poll
    }
    // Register this device for remote push. If it succeeds, the backend
    // sends real pushes (even to a closed phone), so we stop firing the
    // poll-based local notification to avoid duplicates.
    registerForPush()
      .then((pt) => {
        if (pt) {
          pushRegistered.current = true;
          api.registerPush(pt).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const verifyCode = useCallback(
    async (phone: string, code: string, campusId: string): Promise<boolean> => {
      try {
        const { token, session: s } = await api.verify(phone, code, campusId);
        await finishLogin(token, s);
        return true;
      } catch {
        return false;
      }
    },
    [finishLogin]
  );

  // Firebase phone auth path: the client verifies the SMS code with Firebase,
  // then hands the resulting ID token here to exchange for a Blink session.
  const verifyFirebaseToken = useCallback(
    async (idToken: string, campusId: string): Promise<boolean> => {
      try {
        const { token, session: s } = await api.verifyFirebase(idToken, campusId);
        await finishLogin(token, s);
        return true;
      } catch {
        return false;
      }
    },
    [finishLogin]
  );

  const signOut = useCallback(() => {
    setToken(null);
    setSession(null);
    setOrders([]);
    setCart([]);
    loggedIn.current = false;
  }, []);

  // A cart line is keyed by product + chosen modifier, so the same product
  // with different modifiers are separate lines.
  const setQty = useCallback((productId: string, qty: number, modifier = '') => {
    setCart((prev) => {
      const next = prev.filter((i) => !(i.productId === productId && i.modifier === modifier));
      if (qty > 0) next.push({ productId, qty, modifier });
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartSubtotal = useMemo(
    () =>
      cart.reduce((sum, i) => {
        const p = products.find((x) => x.id === i.productId);
        return sum + (p ? unitPrice(p, i.modifier) * i.qty : 0);
      }, 0),
    [cart, products]
  );
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const placeOrder = useCallback(
    async (input: PlaceOrderInput): Promise<Order | null> => {
      if (!session || cart.length === 0) return null;
      try {
        const { order, session: s } = await api.placeOrder({
          items: cart.map((i) => ({ productId: i.productId, qty: i.qty, modifier: i.modifier })),
          building: input.building,
          note: input.note,
          tip: input.tip,
          redeemPoints: input.redeemPoints,
        });
        setSession(s);
        setOrders((prev) => [order, ...prev]);
        setCart([]);
        return order;
      } catch {
        return null;
      }
    },
    [session, cart]
  );

  const resolveItem = useCallback(
    async (
      orderId: string,
      itemId: string,
      choice: { substituteProductId?: string; refund?: boolean }
    ) => {
      try {
        const updated = await api.resolveItem(orderId, itemId, choice);
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      } catch {
        // next poll will reconcile
      }
    },
    []
  );

  const markNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.markNotificationsRead();
    } catch {
      // next poll will reconcile
    }
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Drop every item of a bundle into the cart in one tap.
  const addBundle = useCallback((bundle: Bundle) => {
    setCart((prev) => {
      const next = [...prev];
      for (const pid of bundle.productIds) {
        const line = next.find((i) => i.productId === pid && i.modifier === '');
        if (line) line.qty += 1;
        else next.push({ productId: pid, qty: 1, modifier: '' });
      }
      return next;
    });
  }, []);

  const applyReferralCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const { session: s } = await api.applyReferral(code);
      setSession(s);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value: AppState = {
    ready,
    session,
    products,
    categories,
    markup,
    cart,
    orders,
    notifications,
    unreadCount,
    catalogError,
    productById,
    sendCode,
    verifyCode,
    verifyFirebaseToken,
    firebaseEnabled,
    signOut,
    setQty,
    clearCart,
    cartCount,
    cartSubtotal,
    placeOrder,
    resolveItem,
    markNotificationsRead,
    bundles,
    stats,
    addBundle,
    applyReferralCode,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
