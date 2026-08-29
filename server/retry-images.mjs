import fs from 'node:fs';
const TERMS = {
  s02:'Cheetos crunchy', s06:'Ruffles cheddar sour cream', s07:'Smartfood popcorn white cheddar',
  s11:'Lays classic', s12:'Takis fuego', w01:'Oreo', w03:'Sour Patch Kids', w04:'M&M peanut',
  d01:'Coca Cola', d02:'Sprite soda', e03:'Celsius', e04:'Alani Nu', x01:'Advil', x03:'Toothpaste',
};
const map = JSON.parse(fs.readFileSync('product-images.json','utf8'));
const UA = { 'User-Agent':'BlinkCampusDemo/1.0 (student project)' };
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
for (const [id, term] of Object.entries(TERMS)) {
  if (map[id]) continue;
  try {
    const u = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(term)+'&search_simple=1&action=process&json=1&page_size=1&fields=image_front_url';
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(12000) });
    if (!(r.headers.get('content-type')||'').includes('json')) { console.log(id,'rate, skip'); await sleep(3000); continue; }
    const j = await r.json();
    const url = j.products && j.products[0] && j.products[0].image_front_url;
    if (!url) { console.log(id,'no image'); await sleep(2000); continue; }
    const img = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length < 2000) { console.log(id,'small'); await sleep(2000); continue; }
    fs.writeFileSync('public/products/'+id+'.jpg', buf);
    map[id] = '/products/'+id+'.jpg';
    console.log(id,'OK',buf.length);
    await sleep(2500);
  } catch(e){ console.log(id,'ERR',e.message); await sleep(2500); }
}
fs.writeFileSync('product-images.json', JSON.stringify(map, null, 2));
console.log('\nTOTAL now:', Object.keys(map).length);
