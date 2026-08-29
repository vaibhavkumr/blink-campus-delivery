// Restaurants near UNL City Campus. Brand colors are used for the vendor
// cards + menu headers; menu items are filtered out of the catalog by
// vendorId (see server/seed-data.js — ids match).
export interface Restaurant {
  id: string;
  name: string;
  color: string;
  blurb: string;
}

export const RESTAURANTS: Restaurant[] = [
  { id: 'rc_canes', name: "Raising Cane's", color: '#C1272D', blurb: 'Chicken fingers' },
  { id: 'rc_arbys', name: "Arby's", color: '#D5202A', blurb: 'Roast beef & curly fries' },
  { id: 'rc_panda', name: 'Panda Express', color: '#C4122E', blurb: 'Orange chicken & bowls' },
  { id: 'rc_chipotle', name: 'Chipotle', color: '#7A1E12', blurb: 'Burritos & bowls' },
];

export const restaurantById = (id: string) => RESTAURANTS.find((r) => r.id === id);
