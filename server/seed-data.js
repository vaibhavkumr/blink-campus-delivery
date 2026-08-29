'use strict';

// Blink catalog — UNL only. Snacks are from the product photo (real names +
// prices). Alcoholic items (e.g. Cutwater) are intentionally excluded until
// liquor licensing + ID verification are in place. Prices are in cents.

// id -> "/products/<id>.jpg" for downloaded product photos (may be empty).
let PRODUCT_IMAGES = {};
try {
  PRODUCT_IMAGES = require('./product-images.json');
} catch {
  PRODUCT_IMAGES = {};
}

const CATEGORIES = [
  { key: 'Salty Snacks', emoji: '🧂', sort: 1 },
  { key: 'Sweet', emoji: '🍫', sort: 2 },
  { key: 'Drinks', emoji: '🥤', sort: 3 },
  { key: 'Energy', emoji: '⚡', sort: 4 },
  { key: 'Essentials', emoji: '🧻', sort: 5 },
];

// Fulfillment partners for the UNL launch. kitchen:1 = cook-to-order
// restaurant (routes through the kitchen order flow); kitchen:0 = pick-and-go
// shop / convenience. All four restaurants sit near City Campus.
const VENDORS = [
  { id: 'snackhub', name: 'Blink Snack Hub', emoji: '🛒', kitchen: 0, is_active: 1 },
  { id: 'rc_canes', name: "Raising Cane's", emoji: '🍗', kitchen: 1, is_active: 1 },
  { id: 'rc_arbys', name: "Arby's", emoji: '🥪', kitchen: 1, is_active: 1 },
  { id: 'rc_panda', name: 'Panda Express', emoji: '🥡', kitchen: 1, is_active: 1 },
  { id: 'rc_chipotle', name: 'Chipotle', emoji: '🌯', kitchen: 1, is_active: 1 },
];

const PRODUCTS = [
  // Salty snacks — straight from the product photo
  ['s01', 'Club Original Crackers 13.7oz', '🧀', 839, 'Salty Snacks', 1],
  ['s02', 'Cheetos Flamin’ Hot Limón', '🌶️', 363, 'Salty Snacks', 1],
  ['s03', 'Munchies Flamin’ Hot Snack Mix 8oz', '🔥', 519, 'Salty Snacks', 1],
  ['s04', 'Cheez-It White Cheddar', '🟧', 298, 'Salty Snacks', 1],
  ['s05', 'Cheez-It Original Box', '🟥', 910, 'Salty Snacks', 1],
  ['s06', 'Ruffles Flamin’ Hot Cheddar', '🥔', 363, 'Salty Snacks', 1],
  ['s07', 'Smartfood White Cheddar Popcorn', '🍿', 363, 'Salty Snacks', 1],
  ['s08', 'Doritos Dinamita Chile Limón', '🌮', 714, 'Salty Snacks', 1],
  ['s09', 'Slim Jim Snack Stick', '🥩', 259, 'Salty Snacks', 1],
  ['s10', 'Doritos Nacho Cheese', '🔺', 279, 'Salty Snacks', 1],
  ['s11', 'Lay’s Classic', '🥔', 249, 'Salty Snacks', 1],
  ['s12', 'Takis Fuego', '🌶️', 329, 'Salty Snacks', 1],

  // Sweet
  ['w01', 'Oreo Cookies', '🍪', 449, 'Sweet', 1],
  ['w02', 'Reese’s Cups', '🟤', 199, 'Sweet', 1],
  ['w03', 'Sour Patch Kids', '😝', 249, 'Sweet', 1],
  ['w04', 'M&M’s Peanut', '🟡', 199, 'Sweet', 1],
  ['w05', 'Pop-Tarts', '🧁', 229, 'Sweet', 1],

  // Drinks (non-alcoholic)
  ['d01', 'Coca-Cola 20oz', '🥤', 239, 'Drinks', 1],
  ['d02', 'Sprite 20oz', '🫧', 239, 'Drinks', 1],
  ['d03', 'Gatorade Cool Blue', '💧', 279, 'Drinks', 1],
  ['d04', 'Dasani Water 1L', '🚰', 199, 'Drinks', 1],
  ['d05', 'Arizona Iced Tea', '🍑', 149, 'Drinks', 1],
  ['d06', 'Minute Maid Lemonade', '🍋', 249, 'Drinks', 1],

  // Energy
  ['e01', 'Red Bull 12oz', '🐂', 399, 'Energy', 1],
  ['e02', 'Monster Energy 16oz', '👹', 349, 'Energy', 1],
  ['e03', 'Celsius Sparkling', '🧊', 329, 'Energy', 1],
  ['e04', 'Alani Nu', '🌸', 349, 'Energy', 1],

  // Essentials
  ['x01', 'Advil / Ibuprofen', '💊', 599, 'Essentials', 1],
  ['x02', 'Phone Charger Cable', '🔌', 999, 'Essentials', 1],
  ['x03', 'Toothpaste', '🪥', 349, 'Essentials', 1],
  ['x04', 'Paper Towels', '🧻', 329, 'Essentials', 1],
].map(([id, name, emoji, price_cents, category, in_stock], i) => ({
  id,
  name,
  emoji,
  price_cents,
  category,
  in_stock,
  // Openly-licensed product photo (Open Food Facts) if we have one; the app
  // falls back to the emoji when image_url is null.
  image_url: PRODUCT_IMAGES[id] || null,
  vendor_id: 'snackhub',
  sort: i,
}));

// ── Restaurant menus (near UNL: Cane's, Arby's, Panda, Chipotle) ─────
// Prices in cents. image_url points at /menu/<id>.jpg — a self-hosted
// representative photo drops straight in there; until then the app renders
// an illustrated food stand-in. Modifier priceDelta is in CENTS.
const RESTAURANT_PRODUCTS = [
  // Raising Cane's — chicken fingers
  ['cn1', "The Box Combo (4 fingers)", '🍗', 1099, 'Combos', 'rc_canes'],
  ['cn2', '3 Finger Combo', '🍗', 949, 'Combos', 'rc_canes'],
  ['cn3', 'Caniac Combo (6 fingers)', '🍗', 1399, 'Combos', 'rc_canes'],
  ['cn4', 'Chicken Sandwich Combo', '🥪', 999, 'Combos', 'rc_canes'],
  ['cn5', 'Crinkle-Cut Fries', '🍟', 379, 'Sides', 'rc_canes'],
  ['cn6', "Extra Cane's Sauce", '🥫', 75, 'Sides', 'rc_canes'],
  ['cn7', 'Texas Toast', '🍞', 149, 'Sides', 'rc_canes'],
  ['cn8', 'Sweet Tea', '🧋', 279, 'Drinks', 'rc_canes'],
  ['cn9', 'Fresh Lemonade', '🍋', 299, 'Drinks', 'rc_canes'],

  // Arby's — roast beef
  ['ab1', 'Classic Roast Beef', '🥪', 599, 'Sandwiches', 'rc_arbys'],
  ['ab2', "Beef 'n Cheddar", '🥪', 699, 'Sandwiches', 'rc_arbys'],
  ['ab3', 'Double Roast Beef', '🥪', 849, 'Sandwiches', 'rc_arbys'],
  ['ab4', 'Crispy Chicken Sandwich', '🍔', 699, 'Sandwiches', 'rc_arbys'],
  ['ab5', 'Curly Fries', '🍟', 349, 'Sides', 'rc_arbys'],
  ['ab6', 'Mozzarella Sticks (4)', '🧀', 449, 'Sides', 'rc_arbys'],
  ['ab7', 'Jamocha Shake', '🥤', 399, 'Shakes', 'rc_arbys'],
  ['ab8', 'Fountain Drink', '🥤', 249, 'Drinks', 'rc_arbys'],

  // Panda Express — American Chinese
  ['pd1', 'Bowl · 1 side + 1 entrée', '🥡', 899, 'Meals', 'rc_panda'],
  ['pd2', 'Plate · 1 side + 2 entrées', '🥡', 1149, 'Meals', 'rc_panda'],
  ['pd4', 'Orange Chicken (à la carte)', '🍗', 599, 'Entrées', 'rc_panda'],
  ['pd5', 'Chow Mein', '🍜', 499, 'Sides', 'rc_panda'],
  ['pd6', 'Fried Rice', '🍚', 499, 'Sides', 'rc_panda'],
  ['pd7', 'Cream Cheese Rangoon (3)', '🥟', 329, 'Appetizers', 'rc_panda'],
  ['pd8', 'Veggie Spring Roll (2)', '🥬', 279, 'Appetizers', 'rc_panda'],
  ['pd9', 'Fountain Drink', '🥤', 259, 'Drinks', 'rc_panda'],

  // Chipotle — burritos & bowls
  ['cp1', 'Burrito', '🌯', 899, 'Entrées', 'rc_chipotle'],
  ['cp2', 'Burrito Bowl', '🥗', 899, 'Entrées', 'rc_chipotle'],
  ['cp3', 'Tacos (3)', '🌮', 899, 'Entrées', 'rc_chipotle'],
  ['cp4', 'Quesadilla', '🫓', 999, 'Entrées', 'rc_chipotle'],
  ['cp5', 'Chips & Guacamole', '🥑', 479, 'Sides', 'rc_chipotle'],
  ['cp6', 'Chips & Queso Blanco', '🧀', 449, 'Sides', 'rc_chipotle'],
  ['cp7', 'Mexican Coca-Cola', '🥤', 329, 'Drinks', 'rc_chipotle'],
].map(([id, name, emoji, price_cents, category, vendor_id], i) => ({
  id,
  name,
  emoji,
  price_cents,
  category,
  in_stock: 1,
  image_url: `/menu/${id}.jpg`, // representative photo when present; art fallback otherwise
  vendor_id,
  sort: 100 + i,
}));

// Modifier groups. `required:1` = must pick one; `max:n` = multi-select up to
// n (radio when max is absent/1). Menu items can carry several groups; the
// client customizer joins the chosen labels with " · " into the cart's
// modifier string, and the server sums each matched option's delta. (No option
// label may contain " · " — it's the delimiter.) priceDelta is in CENTS.
const opts = (labels) => labels.map((label) => ({ label, priceDelta: 0 }));

const CANES_DRINK = {
  name: 'Drink', required: 1,
  options: opts(['Sweet Tea', 'Unsweet Tea', 'Fresh Lemonade', 'Coca-Cola', 'Diet Coke', 'Dr Pepper', 'Bottled Water']),
};
const ARBYS_COMBO = {
  name: 'Make it a combo', required: 0,
  options: [
    { label: 'Sandwich only', priceDelta: 0 },
    { label: 'Combo (curly fries + drink)', priceDelta: 449 },
  ],
};
const ARBYS_SIZE = {
  name: 'Size', required: 0,
  options: [
    { label: 'Small', priceDelta: 0 },
    { label: 'Medium', priceDelta: 80 },
    { label: 'Large', priceDelta: 150 },
  ],
};

// ── Panda build-your-own ──
const PANDA_SIDE = {
  name: 'Side', required: 1,
  options: opts(['Chow Mein', 'Fried Rice', 'White Rice', 'Super Greens', 'Half Chow Mein / Half Greens']),
};
const PANDA_ENTREE_OPTIONS = [
  { label: 'Orange Chicken', priceDelta: 0 },
  { label: 'Beijing Beef', priceDelta: 0 },
  { label: 'Broccoli Beef', priceDelta: 0 },
  { label: 'Kung Pao Chicken', priceDelta: 0 },
  { label: 'Grilled Teriyaki Chicken', priceDelta: 0 },
  { label: 'Mushroom Chicken', priceDelta: 0 },
  { label: 'Honey Walnut Shrimp', priceDelta: 150 },
];
const PANDA_ENTREE = { name: 'Entrée', required: 1, options: PANDA_ENTREE_OPTIONS };
const PANDA_ENTREE_1 = { name: 'Entrée 1', required: 1, options: PANDA_ENTREE_OPTIONS };
const PANDA_ENTREE_2 = { name: 'Entrée 2', required: 1, options: PANDA_ENTREE_OPTIONS };

// ── Chipotle build-your-own ──
const CHIPOTLE_PROTEIN = {
  name: 'Protein', required: 1,
  options: [
    { label: 'Chicken', priceDelta: 0 },
    { label: 'Sofritas', priceDelta: 0 },
    { label: 'Veggie', priceDelta: 0 },
    { label: 'Carnitas', priceDelta: 100 },
    { label: 'Barbacoa', priceDelta: 150 },
    { label: 'Steak', priceDelta: 150 },
  ],
};
const CHIPOTLE_RICE = { name: 'Rice', required: 1, options: opts(['White Rice', 'Brown Rice', 'No Rice']) };
const CHIPOTLE_BEANS = { name: 'Beans', required: 1, options: opts(['Black Beans', 'Pinto Beans', 'No Beans']) };
const CHIPOTLE_SALSA = {
  name: 'Salsa', required: 0, max: 4,
  options: opts(['Mild Salsa', 'Medium Salsa', 'Hot Salsa', 'Corn Salsa']),
};
const CHIPOTLE_TOPPINGS = {
  name: 'Free toppings', required: 0, max: 4,
  options: opts(['Cheese', 'Sour Cream', 'Lettuce', 'Fajita Veggies']),
};
// Premium add-ons priced by portion (regular vs. double).
const CHIPOTLE_GUAC = {
  name: 'Guacamole', required: 0,
  options: [
    { label: 'Guacamole', priceDelta: 250 },
    { label: 'Double Guacamole', priceDelta: 500 },
  ],
};
const CHIPOTLE_QUESO = {
  name: 'Queso blanco', required: 0,
  options: [
    { label: 'Queso Blanco', priceDelta: 150 },
    { label: 'Double Queso Blanco', priceDelta: 300 },
  ],
};

const CHIPOTLE_FULL = [
  CHIPOTLE_PROTEIN, CHIPOTLE_RICE, CHIPOTLE_BEANS,
  CHIPOTLE_SALSA, CHIPOTLE_TOPPINGS, CHIPOTLE_GUAC, CHIPOTLE_QUESO,
];

const MODIFIERS = {
  cn1: [CANES_DRINK], cn2: [CANES_DRINK], cn3: [CANES_DRINK], cn4: [CANES_DRINK],
  ab1: [ARBYS_COMBO], ab2: [ARBYS_COMBO], ab3: [ARBYS_COMBO], ab4: [ARBYS_COMBO],
  ab5: [ARBYS_SIZE], ab8: [ARBYS_SIZE],
  pd1: [PANDA_SIDE, PANDA_ENTREE],
  pd2: [PANDA_SIDE, PANDA_ENTREE_1, PANDA_ENTREE_2],
  cp1: CHIPOTLE_FULL,
  cp2: CHIPOTLE_FULL,
  cp3: [CHIPOTLE_PROTEIN, CHIPOTLE_SALSA, CHIPOTLE_TOPPINGS, CHIPOTLE_GUAC, CHIPOTLE_QUESO],
  cp4: [CHIPOTLE_PROTEIN, CHIPOTLE_TOPPINGS, CHIPOTLE_GUAC, CHIPOTLE_QUESO],
};

// ── UNL only ─────────────────────────────────────────────────────────
// Store = the campus-edge shop couriers pick up from. Buildings get real-ish
// coordinates near campus so geofencing + fastest-route work.
function withCoords(center, names) {
  return names.map((name, i) => {
    const ring = (i % 6) * (Math.PI / 3);
    const r = 0.0022 + (i % 3) * 0.0011;
    return { name, lat: center.lat + r * Math.cos(ring), lng: center.lng + r * Math.sin(ring) };
  });
}

const UNL_STORE = { lat: 40.8243, lng: -96.7051 };
const UNL_CENTER = { lat: 40.8203, lng: -96.7005 };

const CAMPUSES = [
  {
    id: 'unl',
    name: 'University of Nebraska–Lincoln',
    city: 'Lincoln',
    short: 'UNL',
    store: UNL_STORE,
    center: UNL_CENTER,
    buildings: withCoords(UNL_CENTER, [
      'Abel Hall', 'Sandoz Hall', 'Schramm Hall', 'Smith Hall',
      'Harper Hall', 'Selleck Quadrangle', 'Knoll Residential Center',
      'University Suites', 'Eastside Suites', 'The Village',
      'Nebraska Union', 'Love Library', 'Kauffman Center', 'Neihardt Hall',
      'Cather Dining', 'Greek Row',
    ]),
  },
];

// ── Geofence: UNL delivery zone (rough campus + near-campus boundary) ─
// A convex-ish polygon around City Campus. Point-in-polygon (ray casting)
// decides whether a drop-off pin is deliverable. [lng, lat] pairs.
const GEOFENCE = {
  unl: [
    [-96.7110, 40.8280],
    [-96.6950, 40.8280],
    [-96.6880, 40.8210],
    [-96.6900, 40.8120],
    [-96.7010, 40.8090],
    [-96.7120, 40.8140],
    [-96.7140, 40.8220],
  ],
};

// Student couriers.
const COURIERS = [
  { id: 'crr_ava', name: 'Ava M.', scooter_deposit_cents: 0, deposit_status: 'none' },
  { id: 'crr_leo', name: 'Leo K.', scooter_deposit_cents: 0, deposit_status: 'none' },
];

// Curated bundles shown on the shop home ("Blink Picks"). Tapping one drops
// every item into the cart. IDs reference PRODUCTS above.
const BUNDLES = [
  { id: 'bd_munchies', name: '2 AM Munchies', emoji: '🌙', productIds: ['s02', 's12', 'd01'] },
  { id: 'bd_study', name: 'Study Fuel', emoji: '📚', productIds: ['e01', 's07', 'w03'] },
  { id: 'bd_movie', name: 'Movie Night', emoji: '🎬', productIds: ['s07', 'w01', 'd01', 'd02'] },
  { id: 'bd_allnighter', name: 'All-Nighter', emoji: '⚡', productIds: ['e01', 'e02', 's02', 's08'] },
];

const ALL_PRODUCTS = [...PRODUCTS, ...RESTAURANT_PRODUCTS];

module.exports = {
  CATEGORIES,
  PRODUCTS: ALL_PRODUCTS,
  VENDORS,
  MODIFIERS,
  CAMPUSES,
  GEOFENCE,
  COURIERS,
  BUNDLES,
};
