import fs from 'node:fs';
// Product id -> Open Food Facts search term. OFF photos are openly licensed
// (CC/ODbL). Essentials/non-food (charger) are left to the emoji fallback.
const TERMS = {
  s01:'Club crackers', s02:'Cheetos Flamin Hot Limon', s03:'Munchies snack mix',
  s04:'Cheez-It White Cheddar', s05:'Cheez-It Original', s06:'Ruffles Flamin Hot Cheddar Sour Cream',
  s07:'Smartfood White Cheddar Popcorn', s08:'Doritos Dinamita Chile Limon', s09:'Slim Jim Original',
  s10:'Doritos Nacho Cheese', s11:"Lay's Classic potato chips", s12:'Takis Fuego',
  w01:'Oreo cookies', w02:"Reese's Peanut Butter Cups", w03:'Sour Patch Kids',
  w04:"M&M's Peanut", w05:'Pop-Tarts', d01:'Coca-Cola', d02:'Sprite',
  d03:'Gatorade Cool Blue', d04:'Dasani water', d05:'Arizona iced tea',
  d06:'Minute Maid Lemonade', e01:'Red Bull energy drink', e02:'Monster Energy',
  e03:'Celsius energy drink', e04:'Alani Nu energy', x01:'Advil ibuprofen',
  x03:'Colgate toothpaste', x04:'Bounty paper towels',
};
const UA = { 'User-Agent':'BlinkCampusDemo/1.0 (student project)' };
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const map = {};
fs.mkdirSync('public/products', { recursive: true });
for (const [id, term] of Object.entries(TERMS)) {
  try {
    const u = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(term)+'&search_simple=1&action=process&json=1&page_size=1&fields=image_front_url';
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(12000) });
    const ct = r.headers.get('content-type')||'';
    if (!ct.includes('json')) { console.log(id, 'rate/HTML, skip'); await sleep(1500); continue; }
    const j = await r.json();
    const url = j.products && j.products[0] && j.products[0].image_front_url;
    if (!url) { console.log(id, 'no image'); await sleep(700); continue; }
    const img = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length < 2000) { console.log(id, 'too small'); await sleep(700); continue; }
    fs.writeFileSync('public/products/'+id+'.jpg', buf);
    map[id] = '/products/'+id+'.jpg';
    console.log(id, 'OK', buf.length);
    await sleep(700);
  } catch(e){ console.log(id, 'ERR', e.message); await sleep(700); }
}
fs.writeFileSync('product-images.json', JSON.stringify(map, null, 2));
console.log('\nDONE:', Object.keys(map).length, 'of', Object.keys(TERMS).length, 'images');
