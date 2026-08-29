# Representative menu imagery

Blink is a third-party courier — we have **no license to a restaurant's own photos**.
So restaurant menu items use *representative* imagery: a generic, appetizing image
of the dish type (one "burrito" image stands in for any burrito), clearly labeled
**"Representative"** in the app so it never claims to be that restaurant's exact plate.

## How it works
- Each menu item's `image_url` is `/menu/<id>.jpg` (see `server/seed-data.js`).
- Drop a JPG named after the item id into this folder → it shows automatically.
- No file yet? The app renders an illustrated food stand-in (`FoodArt`) instead.
- Any real photo gets a small **"Representative"** badge in the UI (honesty + legal safety).

## Two ways to fill this folder
1. **AI-generated** (option 5 — recommended, no licensing): run the prompts below in
   any image generator, export square ~1024×1024 JPGs, name them `<id>.jpg`.
2. **Licensed stock**: buy/download openly-licensed dish photos (e.g. Pexels/Unsplash
   under their license, or a paid library) — same naming.

Keep them **generic dish shots on a clean/neutral background** — do NOT use images that
show a restaurant's branding, logo, packaging, or trade dress.

## AI prompt pack (one per hero dish)
Base style to prepend to each: *"Appetizing food photography, top-down or 3/4 angle,
soft natural light, clean neutral background, no branding or logos, no packaging, high
detail, square crop."*

| id  | dish | prompt subject |
|-----|------|----------------|
| cn1 | Cane's box combo | golden fried chicken tenders with crinkle-cut fries, Texas toast, coleslaw, dipping sauce cup |
| cn2 | 3 finger combo | three golden chicken tenders with fries and a sauce cup |
| cn3 | Caniac combo | six crispy chicken tenders, fries, toast |
| cn4 | chicken sandwich combo | crispy chicken sandwich with fries |
| cn5 | crinkle fries | crinkle-cut french fries in a paper cup |
| cn8 | sweet tea | iced sweet tea in a clear cup |
| cn9 | lemonade | fresh lemonade with ice and lemon |
| ab1 | classic roast beef | roast beef sandwich on a sesame bun |
| ab2 | beef 'n cheddar | roast beef sandwich with cheddar sauce on an onion roll |
| ab3 | double roast beef | tall stacked roast beef sandwich |
| ab4 | crispy chicken | crispy chicken sandwich with lettuce and tomato |
| ab5 | curly fries | seasoned curly fries in a cup |
| ab6 | mozzarella sticks | four breaded mozzarella sticks with marinara |
| ab7 | jamocha shake | chocolate-coffee milkshake with whipped cream |
| pd1 | panda bowl | bowl of orange chicken over chow mein |
| pd2 | panda plate | plate with orange chicken, beijing beef, fried rice |
| pd4 | orange chicken | glossy orange chicken pieces |
| pd5 | chow mein | stir-fried chow mein noodles with vegetables |
| pd6 | fried rice | fried rice with egg and vegetables |
| pd7 | rangoon | three cream cheese rangoon (crab puffs) |
| pd8 | spring roll | two crispy veggie spring rolls |
| cp1 | burrito | large foil-wrapped burrito cut in half showing filling |
| cp2 | burrito bowl | burrito bowl with rice, beans, chicken, salsa, guac |
| cp3 | tacos | three soft tacos with meat, salsa, cilantro |
| cp4 | quesadilla | cheese quesadilla wedges |
| cp5 | chips & guac | tortilla chips with a bowl of guacamole |
| cp6 | chips & queso | tortilla chips with white queso |
| cp7 | mexican coke | glass bottle cola with ice (generic, no label) |

Sides/drinks not listed reuse the closest illustration by default.
