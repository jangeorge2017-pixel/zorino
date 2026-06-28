// ZORINO Homepage Builder — builds editable homepage from zorino-final-design.png
// Run: Figma → Plugins → Development → Import plugin from manifest → select this folder

const W = 1920;
const PAD = 200;
const CONTENT = 1520;

const C = {
  bgDeep: "#020611",
  bgHero: "#030712",
  bgDefault: "#040615",
  glass: "#0f172a",
  text: "#f8fafc",
  textSoft: "#94a3b8",
  textMuted: "#64748b",
  purple: "#8b5cf6",
  indigo: "#6366f1",
  cyan: "#22d3ee",
  green: "#22c55e",
  red: "#ef4444",
  yellow: "#fde68a",
};

const NAV_LINKS = ["Deals", "Coupons", "Compare", "Categories", "Stores", "Blog"];
const HERO_STATS = [
  ["50+", "Stores"],
  ["10M+", "Products"],
  ["100K+", "Coupons"],
  ["Real-time", "Price Tracking"],
];
const POPULAR = [
  "iPhone 15 Pro Max",
  "MacBook Air M3",
  "Samsung Galaxy S24",
  "Sony WH-1000XM5",
  "Nintendo Switch OLED",
  "Dyson V15 Detect",
];
const CATEGORIES = [
  ["Phones", "pink"],
  ["Laptops", "blue"],
  ["Gaming", "green"],
  ["TVs", "red"],
  ["Home", "yellow"],
  ["Wearables", "purple"],
  ["Fashion", "pink"],
  ["More", "gray"],
];
const DEALS = [
  ["Apple AirPods Pro 2nd Gen", "4.8", "2,847", "$219", "$249", "Amazon", "a", "2", 12],
  ["Samsung Galaxy S24 Ultra", "4.7", "1,523", "$1,099", "$1,199", "Best Buy", "BB", "5", 8],
  ["MacBook Air M3 13-inch", "4.9", "892", "$999", "$1,099", "Apple", "AP", "8", 10],
  ["PlayStation 5 Console", "4.6", "3,421", "$449", "$499", "Walmart", "W", "12", 15],
];
const COUPONS = [
  ["Amazon", "10% OFF Sitewide", "Min spend $50", "SAVE10", "1,240"],
  ["Noon", "15% OFF Electronics", "Min spend $100", "NOON15", "856"],
  ["AliExpress", "20% OFF First Order", "Min spend $30", "AE20", "2,341"],
  ["Nike", "25% OFF Sportswear", "Min spend $75", "NIKE25", "567"],
];
const FEATURES = [
  ["AI Recommendations", "Smart AI suggests the best products and deals for you.", "purple"],
  ["Real-time Price Tracking", "We track price changes 24/7 so you never overpay.", "pink"],
  ["Verified Coupons", "Thousands of verified coupons updated daily.", "green"],
  ["Global Coverage", "Compare prices from 50+ countries and global stores.", "blue"],
];
const FOOTER_STATS = [
  ["50+", "Stores"],
  ["10M+", "Products"],
  ["100K+", "Coupons"],
  ["5M+", "Happy Users"],
];
const ORBIT = [
  ["-25%", "$249", "$329"],
  ["-18%", "$899", "$1,099"],
  ["-15%", "$999", "$1,199"],
  ["-20%", "$59", "$74"],
];

function rgb(hex) {
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16) / 255,
    g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255,
  };
}

function solid(hex, opacity) {
  const c = rgb(hex);
  return { type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: opacity == null ? 1 : opacity };
}

function grad(stops) {
  return {
    type: "GRADIENT_LINEAR",
    gradientTransform: [[1, 0, 0], [0, 1, 0]],
    gradientStops: stops.map(function (s) {
      const c = rgb(s.c);
      return { position: s.p, color: { r: c.r, g: c.g, b: c.b, a: 1 } };
    }),
  };
}

const GRAD_PRIMARY = grad([
  { p: 0, c: C.purple },
  { p: 1, c: C.indigo },
]);

const FONT = "Inter";
const fontCache = {};

async function ensureFont(style) {
  if (!fontCache[style]) {
    await figma.loadFontAsync({ family: FONT, style: style });
    fontCache[style] = true;
  }
}

async function mkText(name, chars, size, style, color, width) {
  await ensureFont(style);
  const t = figma.createText();
  t.name = name;
  t.characters = chars;
  t.fontSize = size;
  t.fontName = { family: FONT, style: style };
  t.fills = [solid(color)];
  if (width) {
    t.textAutoResize = "HEIGHT";
    t.resize(width, t.height);
  }
  return t;
}

function frame(name, dir) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir || "VERTICAL";
  f.primaryAxisSizingMode = "AUTO";
  f.counterAxisSizingMode = "AUTO";
  f.fills = [];
  return f;
}

function stroke(opacity) {
  return [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: opacity || 0.08 }];
}

function pad(f, t, r, b, l) {
  f.paddingTop = t;
  f.paddingRight = r == null ? t : r;
  f.paddingBottom = b == null ? t : b;
  f.paddingLeft = l == null ? r : l;
}

function fillParent(child) {
  child.layoutSizingHorizontal = "FILL";
}

async function createTokens() {
  const colors = figma.variables.createVariableCollection("ZORINO / Colors");
  const mode = colors.modes[0].modeId;
  colors.renameMode(mode, "Dark");
  function addColor(name, value, scopes) {
    const v = figma.variables.createVariable(name, colors, "COLOR");
    v.scopes = scopes;
    v.setValueForMode(mode, rgb(value));
    return v;
  }
  addColor("bg/deep", C.bgDeep, ["FRAME_FILL", "SHAPE_FILL"]);
  addColor("bg/hero", C.bgHero, ["FRAME_FILL", "SHAPE_FILL"]);
  addColor("text/primary", C.text, ["TEXT_FILL"]);
  addColor("text/secondary", C.textSoft, ["TEXT_FILL"]);
  addColor("accent/purple", C.purple, ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"]);
  addColor("accent/indigo", C.indigo, ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"]);
  addColor("accent/green", C.green, ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"]);

  const spacing = figma.variables.createVariableCollection("ZORINO / Spacing");
  const sm = spacing.modes[0].modeId;
  function addFloat(name, value, scopes) {
    const v = figma.variables.createVariable(name, spacing, "FLOAT");
    v.scopes = scopes;
    v.setValueForMode(sm, value);
    return v;
  }
  addFloat("space/sm", 8, ["GAP", "WIDTH_HEIGHT", "CORNER_RADIUS"]);
  addFloat("space/md", 12, ["GAP", "WIDTH_HEIGHT", "CORNER_RADIUS"]);
  addFloat("space/lg", 16, ["GAP", "WIDTH_HEIGHT", "CORNER_RADIUS"]);
  addFloat("space/xl", 24, ["GAP", "WIDTH_HEIGHT", "CORNER_RADIUS"]);
  addFloat("radius/md", 12, ["CORNER_RADIUS"]);
  addFloat("radius/lg", 16, ["CORNER_RADIUS"]);
}

async function createDealComponent(page) {
  const comp = figma.createComponent();
  comp.name = "Card / Deal";
  comp.layoutMode = "VERTICAL";
  comp.resize(280, 400);
  comp.itemSpacing = 10;
  pad(comp, 14);
  comp.cornerRadius = 18;
  comp.fills = [solid(C.glass, 0.72)];
  comp.strokes = stroke(0.09);
  comp.strokeWeight = 1;
  comp.x = 80;
  comp.y = 80;
  page.appendChild(comp);

  const media = frame("Deal / Media", "VERTICAL");
  media.resize(252, 168);
  media.layoutSizingHorizontal = "FIXED";
  media.cornerRadius = 14;
  media.fills = [solid("#1e293b", 0.85)];
  media.strokes = stroke(0.06);
  media.strokeWeight = 1;
  media.primaryAxisAlignItems = "CENTER";
  media.counterAxisAlignItems = "CENTER";

  const badge = frame("Deal / Discount", "HORIZONTAL");
  pad(badge, 3, 7);
  badge.cornerRadius = 6;
  badge.fills = [GRAD_PRIMARY];
  badge.layoutPositioning = "ABSOLUTE";
  badge.x = 10;
  badge.y = 10;
  const badgeText = await mkText("Deal / Discount Label", "-12%", 10, "Bold", C.text);
  badge.appendChild(badgeText);
  media.appendChild(badge);

  const title = await mkText("Deal / Title", "Apple AirPods Pro 2nd Gen", 14, "Bold", C.text, 252);
  const rating = await mkText("Deal / Rating", "★★★★★ 4.8 (2,847)", 11, "Regular", C.textMuted);
  const drop = frame("Deal / Price Drop", "HORIZONTAL");
  pad(drop, 3, 8);
  drop.cornerRadius = 6;
  drop.fills = [solid(C.green, 0.14)];
  drop.strokes = [{ type: "SOLID", color: rgb(C.green), opacity: 0.28 }];
  drop.strokeWeight = 1;
  const dropText = await mkText("Deal / Drop Label", "Price dropped", 11, "Bold", "#86efac");
  drop.appendChild(dropText);

  const prices = frame("Deal / Prices", "HORIZONTAL");
  prices.itemSpacing = 8;
  prices.appendChild(await mkText("Deal / Price", "$219", 22, "Bold", C.text));
  prices.appendChild(await mkText("Deal / Was", "$249", 13, "Regular", C.textMuted));

  const storeRow = frame("Deal / Store Row", "HORIZONTAL");
  storeRow.primaryAxisAlignItems = "SPACE_BETWEEN";
  storeRow.counterAxisAlignItems = "CENTER";
  storeRow.layoutSizingHorizontal = "FILL";
  const store = frame("Deal / Store", "HORIZONTAL");
  store.itemSpacing = 8;
  const logo = frame("Deal / Store Logo", "HORIZONTAL");
  logo.resize(28, 28);
  logo.cornerRadius = 8;
  logo.fills = [solid(C.glass, 0.65)];
  logo.primaryAxisAlignItems = "CENTER";
  logo.counterAxisAlignItems = "CENTER";
  logo.appendChild(await mkText("Deal / Store Initial", "a", 10, "Bold", C.textSoft));
  store.appendChild(logo);
  store.appendChild(await mkText("Deal / Store Name", "Amazon", 13, "Semi Bold", "#cbd5e1"));
  storeRow.appendChild(store);
  storeRow.appendChild(await mkText("Deal / Updated", "Updated 2 min ago", 10.5, "Regular", C.textMuted));

  const spark = frame("Deal / Sparkline", "HORIZONTAL");
  spark.resize(252, 32);
  spark.fills = [solid("#1e293b", 0.35)];
  spark.cornerRadius = 6;

  const cta = frame("Deal / CTA", "HORIZONTAL");
  cta.primaryAxisAlignItems = "CENTER";
  cta.counterAxisAlignItems = "CENTER";
  pad(cta, 11, 14);
  cta.cornerRadius = 12;
  cta.fills = [GRAD_PRIMARY];
  cta.appendChild(await mkText("Deal / CTA Label", "Compare Prices", 13, "Bold", C.text));
  fillParent(cta);

  comp.appendChild(media);
  comp.appendChild(title);
  comp.appendChild(rating);
  comp.appendChild(drop);
  comp.appendChild(prices);
  comp.appendChild(storeRow);
  comp.appendChild(spark);
  comp.appendChild(cta);

  return comp;
}

async function createCouponComponent(page) {
  const comp = figma.createComponent();
  comp.name = "Card / Coupon";
  comp.layoutMode = "HORIZONTAL";
  comp.resize(420, 88);
  comp.itemSpacing = 12;
  comp.counterAxisAlignItems = "CENTER";
  pad(comp, 14);
  comp.cornerRadius = 16;
  comp.fills = [solid(C.glass, 0.72)];
  comp.strokes = stroke(0.09);
  comp.strokeWeight = 1;
  comp.x = 80;
  comp.y = 520;
  page.appendChild(comp);

  const logo = frame("Coupon / Logo", "HORIZONTAL");
  logo.resize(48, 48);
  logo.cornerRadius = 12;
  logo.fills = [solid(C.glass, 0.65)];
  logo.strokes = stroke(0.08);
  logo.strokeWeight = 1;
  logo.primaryAxisAlignItems = "CENTER";
  logo.counterAxisAlignItems = "CENTER";
  logo.appendChild(await mkText("Coupon / Initial", "a", 12, "Bold", C.textSoft));

  const info = frame("Coupon / Info", "VERTICAL");
  info.itemSpacing = 2;
  info.layoutGrow = 1;
  info.appendChild(await mkText("Coupon / Store", "Amazon", 14, "Bold", C.text));
  info.appendChild(await mkText("Coupon / Offer", "10% OFF Sitewide", 12.5, "Semi Bold", "#e2e8f0"));
  info.appendChild(await mkText("Coupon / Min", "Min spend $50", 11, "Regular", C.textMuted));

  const right = frame("Coupon / Code Wrap", "VERTICAL");
  right.itemSpacing = 4;
  right.counterAxisAlignItems = "MAX";
  const codeBox = frame("Coupon / Code Box", "HORIZONTAL");
  codeBox.itemSpacing = 6;
  pad(codeBox, 8, 10);
  codeBox.cornerRadius = 10;
  codeBox.strokes = [{ type: "SOLID", color: { r: 0.98, g: 0.8, b: 0.08 }, opacity: 0.45, dashPattern: [4, 4] }];
  codeBox.strokeWeight = 1;
  codeBox.fills = [solid("#facc15", 0.06)];
  codeBox.appendChild(await mkText("Coupon / Code", "SAVE10", 13, "Bold", C.yellow));
  right.appendChild(codeBox);
  right.appendChild(await mkText("Coupon / Meta", "Used 1,240 times · Verified", 10.5, "Regular", C.textMuted));

  comp.appendChild(logo);
  comp.appendChild(info);
  comp.appendChild(right);
  return comp;
}

async function buildHeader(parent) {
  const header = frame("Header / Nav", "HORIZONTAL");
  header.resize(W, 72);
  header.layoutSizingHorizontal = "FIXED";
  header.counterAxisSizingMode = "FIXED";
  header.primaryAxisAlignItems = "CENTER";
  header.counterAxisAlignItems = "CENTER";
  pad(header, 0, PAD);
  header.fills = [solid(C.bgHero, 0.78)];
  header.strokes = stroke(0.07);
  header.strokeWeight = 1;
  header.strokeAlign = "INSIDE";

  const inner = frame("Header / Inner", "HORIZONTAL");
  inner.resize(CONTENT, 40);
  inner.layoutSizingHorizontal = "FIXED";
  inner.primaryAxisAlignItems = "SPACE_BETWEEN";
  inner.counterAxisAlignItems = "CENTER";

  const logo = frame("Logo", "HORIZONTAL");
  logo.itemSpacing = 10;
  const mark = frame("Logo / Mark", "HORIZONTAL");
  mark.resize(40, 40);
  mark.cornerRadius = 10;
  mark.fills = [GRAD_PRIMARY];
  logo.appendChild(mark);
  logo.appendChild(await mkText("Logo / Wordmark", "ZORINO", 22, "Semi Bold", C.text));
  logo.appendChild(await mkText("Logo / Tagline", "Find Better Deals Faster", 10, "Medium", "#93c5fd"));

  const links = frame("Nav / Links", "HORIZONTAL");
  links.itemSpacing = 28;
  for (let i = 0; i < NAV_LINKS.length; i++) {
    links.appendChild(await mkText("Nav / " + NAV_LINKS[i], NAV_LINKS[i], 14, "Medium", "#f1f5f9"));
  }

  const actions = frame("Nav / Actions", "HORIZONTAL");
  actions.itemSpacing = 8;

  function iconBtn(label) {
    const b = frame("Button / " + label, "HORIZONTAL");
    b.itemSpacing = 5;
    pad(b, 8, 12);
    b.cornerRadius = 11;
    b.fills = [solid(C.glass, 0.82)];
    b.strokes = stroke(0.1);
    b.strokeWeight = 1;
    b.counterAxisAlignItems = "CENTER";
    return b;
  }

  const searchBtn = iconBtn("Search");
  searchBtn.appendChild(await mkText("Button / Search Icon", "⌕", 16, "Regular", C.text));

  const theme = frame("Nav / Theme", "HORIZONTAL");
  theme.itemSpacing = 2;
  pad(theme, 3);
  theme.cornerRadius = 11;
  theme.fills = [solid(C.glass, 0.82)];
  theme.strokes = stroke(0.1);
  theme.strokeWeight = 1;
  const dark = frame("Nav / Theme Dark", "HORIZONTAL");
  dark.itemSpacing = 4;
  pad(dark, 6, 10);
  dark.cornerRadius = 8;
  dark.fills = [solid(C.purple, 0.38)];
  dark.appendChild(await mkText("Nav / Dark", "Dark", 12, "Semi Bold", C.text));
  const light = frame("Nav / Theme Light", "HORIZONTAL");
  pad(light, 6, 10);
  light.appendChild(await mkText("Nav / Light", "Light", 12, "Semi Bold", C.textSoft));
  theme.appendChild(dark);
  theme.appendChild(light);

  const wishlist = iconBtn("Wishlist");
  wishlist.appendChild(await mkText("Button / Wishlist", "Wishlist", 12.5, "Semi Bold", C.text));

  const bell = iconBtn("Notifications");
  bell.appendChild(await mkText("Button / Bell", "🔔", 14, "Regular", C.text));
  const badge = figma.createEllipse();
  badge.name = "Nav / Badge";
  badge.resize(17, 17);
  badge.fills = [solid(C.red)];
  badge.layoutPositioning = "ABSOLUTE";
  badge.x = 28;
  badge.y = -5;

  const profile = frame("Nav / Profile", "HORIZONTAL");
  profile.itemSpacing = 8;
  pad(profile, 5, 10, 5, 5);
  profile.cornerRadius = 13;
  profile.fills = [solid(C.glass, 0.82)];
  profile.strokes = stroke(0.1);
  profile.strokeWeight = 1;
  const avatar = figma.createEllipse();
  avatar.name = "Nav / Avatar";
  avatar.resize(32, 32);
  avatar.fills = [solid(C.indigo, 0.5)];
  const profileText = frame("Nav / Profile Text", "VERTICAL");
  profileText.appendChild(await mkText("Nav / Hi", "Hi, Ahmed", 11.5, "Semi Bold", C.text));
  profileText.appendChild(await mkText("Nav / Premium", "Premium", 10.5, "Semi Bold", "#c4b5fd"));
  profile.appendChild(avatar);
  profile.appendChild(profileText);

  actions.appendChild(searchBtn);
  actions.appendChild(theme);
  actions.appendChild(wishlist);
  actions.appendChild(bell);
  actions.appendChild(profile);

  inner.appendChild(logo);
  inner.appendChild(links);
  inner.appendChild(actions);
  header.appendChild(inner);
  fillParent(inner);
  parent.appendChild(header);
  fillParent(header);
}

async function buildHeroVisual(parent) {
  const stage = frame("Hero / Visual Stage", "NONE");
  stage.resize(620, 420);
  stage.layoutSizingHorizontal = "FIXED";
  stage.clipsContent = false;

  const glow = figma.createEllipse();
  glow.name = "Hero / Glow";
  glow.resize(420, 380);
  glow.fills = [{
    type: "GRADIENT_RADIAL",
    gradientTransform: [[1, 0, 0.5], [0, 1, 0.5]],
    gradientStops: [
      { position: 0, color: { r: 0.545, g: 0.361, b: 0.965, a: 0.52 } },
      { position: 0.32, color: { r: 0.388, g: 0.4, b: 0.945, a: 0.28 } },
      { position: 1, color: { r: 0, g: 0, b: 0, a: 0 } },
    ],
  }];
  glow.x = 100;
  glow.y = 20;

  const zMark = frame("Hero / Z Illustration", "VERTICAL");
  zMark.resize(180, 180);
  zMark.cornerRadius = 999;
  zMark.fills = [GRAD_PRIMARY];
  zMark.primaryAxisAlignItems = "CENTER";
  zMark.counterAxisAlignItems = "CENTER";
  zMark.layoutPositioning = "ABSOLUTE";
  zMark.x = 220;
  zMark.y = 120;
  zMark.effects = [{ type: "DROP_SHADOW", color: { r: 0.545, g: 0.361, b: 0.965, a: 0.55 }, offset: { x: 0, y: 8 }, radius: 32, spread: 0, visible: true, blendMode: "NORMAL" }];
  zMark.appendChild(await mkText("Hero / Z", "Z", 72, "Bold", C.text));

  const positions = [[250, 0], [20, 80], [430, 60], [60, 260]];
  for (let i = 0; i < ORBIT.length; i++) {
    const card = frame("Orbit / Card " + (i + 1), "VERTICAL");
    card.resize(112, 92);
    pad(card, 8);
    card.cornerRadius = 14;
    card.fills = [solid(C.glass, 0.82)];
    card.strokes = stroke(0.1);
    card.strokeWeight = 1;
    card.layoutPositioning = "ABSOLUTE";
    card.x = positions[i][0];
    card.y = positions[i][1];
    const media = frame("Orbit / Media", "VERTICAL");
    media.resize(96, 56);
    media.cornerRadius = 10;
    media.fills = [solid("#1e293b", 0.8)];
    media.primaryAxisAlignItems = "CENTER";
    media.counterAxisAlignItems = "CENTER";
    const disc = frame("Orbit / Discount", "HORIZONTAL");
    pad(disc, 2, 6);
    disc.cornerRadius = 6;
    disc.fills = [grad([{ p: 0, c: C.green }, { p: 1, c: "#16a34a" }])];
    disc.layoutPositioning = "ABSOLUTE";
    disc.x = 4;
    disc.y = 4;
    disc.appendChild(await mkText("Orbit / Discount", ORBIT[i][0], 9, "Bold", C.text));
    media.appendChild(disc);
    const prices = frame("Orbit / Prices", "HORIZONTAL");
    prices.itemSpacing = 4;
    prices.appendChild(await mkText("Orbit / Price", ORBIT[i][1], 12, "Bold", C.text));
    prices.appendChild(await mkText("Orbit / Was", ORBIT[i][2], 10, "Regular", C.textMuted));
    card.appendChild(media);
    card.appendChild(prices);
    stage.appendChild(card);
  }

  stage.appendChild(glow);
  stage.appendChild(zMark);
  parent.appendChild(stage);
}

async function buildHeroBlock(parent, dealComp, couponComp) {
  const hero = frame("Hero / Block", "VERTICAL");
  hero.itemSpacing = 12;
  pad(hero, 16, PAD, 20, PAD);
  hero.fills = [solid(C.bgHero)];
  hero.strokes = [];

  const row = frame("Hero / Top Row", "HORIZONTAL");
  row.resize(CONTENT, 420);
  row.layoutSizingHorizontal = "FIXED";
  row.itemSpacing = 24;

  const copy = frame("Hero / Copy", "VERTICAL");
  copy.itemSpacing = 16;

  const pill = frame("Badge / Powered by AI", "HORIZONTAL");
  pill.itemSpacing = 6;
  pad(pill, 6, 13);
  pill.cornerRadius = 999;
  pill.fills = [solid(C.purple, 0.14)];
  pill.strokes = [{ type: "SOLID", color: rgb(C.purple), opacity: 0.35 }];
  pill.strokeWeight = 1;
  pill.appendChild(await mkText("Badge / Label", "Powered by AI", 11.5, "Semi Bold", "#ddd6fe"));

  const h1 = await mkText("Hero / Headline", "Find Better Deals Faster", 56, "Bold", C.text, 548);
  const sub = await mkText("Hero / Subcopy", "Compare prices across thousands of stores and discover the best deals in seconds.", 16, "Regular", C.textSoft, 480);

  const stats = frame("Hero / Stats", "HORIZONTAL");
  stats.itemSpacing = 10;
  for (let i = 0; i < HERO_STATS.length; i++) {
    const card = frame("Stat / " + HERO_STATS[i][1], "VERTICAL");
    card.resize(118, 72);
    pad(card, 11, 13);
    card.cornerRadius = 12;
    card.fills = [solid(C.glass, 0.72)];
    card.strokes = stroke(0.09);
    card.strokeWeight = 1;
    card.appendChild(await mkText("Stat / Value", HERO_STATS[i][0], 16, "Bold", C.text));
    card.appendChild(await mkText("Stat / Label", HERO_STATS[i][1], 10.5, "Regular", C.textSoft));
    stats.appendChild(card);
  }

  copy.appendChild(pill);
  copy.appendChild(h1);
  copy.appendChild(sub);
  copy.appendChild(stats);
  row.appendChild(copy);
  copy.layoutGrow = 1;
  await buildHeroVisual(row);
  hero.appendChild(row);
  fillParent(row);

  const search = frame("Search / Bar", "HORIZONTAL");
  search.resize(CONTENT, 56);
  search.layoutSizingHorizontal = "FIXED";
  search.itemSpacing = 8;
  search.counterAxisAlignItems = "CENTER";
  pad(search, 6, 6, 6, 16);
  search.cornerRadius = 16;
  search.fills = [solid(C.glass, 0.92)];
  search.strokes = stroke(0.1);
  search.strokeWeight = 1;
  search.appendChild(await mkText("Search / Placeholder", "Search for products, brands, or categories...", 15, "Regular", C.textMuted));
  search.children[0].layoutGrow = 1;
  const ai = frame("Search / AI Pill", "HORIZONTAL");
  pad(ai, 9, 12);
  ai.cornerRadius = 9;
  ai.fills = [solid(C.purple, 0.14)];
  ai.strokes = [{ type: "SOLID", color: rgb(C.purple), opacity: 0.38 }];
  ai.strokeWeight = 1;
  ai.appendChild(await mkText("Search / AI", "AI Search", 12.5, "Semi Bold", "#ddd6fe"));
  const submit = frame("Button / Search Submit", "HORIZONTAL");
  pad(submit, 11, 26);
  submit.cornerRadius = 11;
  submit.fills = [GRAD_PRIMARY];
  submit.appendChild(await mkText("Button / Search Label", "Search", 13.5, "Bold", C.text));
  search.appendChild(ai);
  search.appendChild(submit);

  const dropdown = frame("Search / Popular Dropdown", "VERTICAL");
  dropdown.itemSpacing = 8;
  pad(dropdown, 16, 20);
  dropdown.cornerRadius = 16;
  dropdown.fills = [solid(C.glass, 0.96)];
  dropdown.strokes = stroke(0.1);
  dropdown.strokeWeight = 1;
  dropdown.appendChild(await mkText("Search / Popular Title", "POPULAR SEARCHES", 12, "Semi Bold", C.textMuted));
  for (let i = 0; i < POPULAR.length; i++) {
    dropdown.appendChild(await mkText("Search / Item", POPULAR[i], 14, "Regular", "#e2e8f0"));
  }

  const cats = frame("Categories / Row", "HORIZONTAL");
  cats.itemSpacing = 10;
  cats.layoutSizingHorizontal = "FILL";
  for (let i = 0; i < CATEGORIES.length; i++) {
    const tile = frame("Category / " + CATEGORIES[i][0], "VERTICAL");
    tile.counterAxisAlignItems = "CENTER";
    tile.primaryAxisAlignItems = "CENTER";
    tile.itemSpacing = 8;
    pad(tile, 16, 8, 12);
    tile.resize(170, 92);
    tile.layoutSizingHorizontal = "FILL";
    tile.cornerRadius = 14;
    tile.fills = [solid("#ffffff", 0.035)];
    tile.strokes = stroke(CATEGORIES[i][1] === "green" ? 0.22 : 0.09);
    tile.strokeWeight = 1;
    const icon = frame("Category / Icon", "HORIZONTAL");
    icon.resize(44, 44);
    icon.cornerRadius = 12;
    icon.fills = [solid(C.glass, 0.65)];
    icon.primaryAxisAlignItems = "CENTER";
    icon.counterAxisAlignItems = "CENTER";
    icon.appendChild(await mkText("Category / Glyph", "◆", 16, "Regular", C.purple));
    tile.appendChild(icon);
    tile.appendChild(await mkText("Category / Label", CATEGORIES[i][0], 12, "Semi Bold", "#e2e8f0"));
    cats.appendChild(tile);
  }

  const commerce = frame("Commerce / Row", "HORIZONTAL");
  commerce.itemSpacing = 28;
  commerce.layoutSizingHorizontal = "FILL";

  const dealsPanel = frame("Panel / Trending Deals", "VERTICAL");
  dealsPanel.itemSpacing = 16;
  pad(dealsPanel, 20, 18);
  dealsPanel.cornerRadius = 20;
  dealsPanel.fills = [solid("#0a0f1e", 0.5)];
  dealsPanel.strokes = stroke(0.09);
  dealsPanel.strokeWeight = 1;
  dealsPanel.resize(920, 100);
  dealsPanel.primaryAxisSizingMode = "AUTO";
  dealsPanel.counterAxisSizingMode = "AUTO";

  const dealsHead = frame("Section / Trending Head", "HORIZONTAL");
  dealsHead.primaryAxisAlignItems = "SPACE_BETWEEN";
  dealsHead.counterAxisAlignItems = "CENTER";
  dealsHead.layoutSizingHorizontal = "FILL";
  dealsHead.appendChild(await mkText("Section / Trending Title", "Trending Deals", 22, "Bold", C.text));
  dealsHead.appendChild(await mkText("Section / Trending Link", "View all deals", 13, "Semi Bold", C.textSoft));

  const dealsTrack = frame("Deals / Track", "HORIZONTAL");
  dealsTrack.itemSpacing = 14;
  dealsTrack.layoutSizingHorizontal = "FILL";
  for (let i = 0; i < DEALS.length; i++) {
    const inst = dealComp.createInstance();
    inst.name = "Instance / Deal " + (i + 1);
    const t = inst.findOne(function (n) { return n.name === "Deal / Title" && n.type === "TEXT"; });
    if (t) t.characters = DEALS[i][0];
    const p = inst.findOne(function (n) { return n.name === "Deal / Price" && n.type === "TEXT"; });
    if (p) p.characters = DEALS[i][3];
    const w = inst.findOne(function (n) { return n.name === "Deal / Was" && n.type === "TEXT"; });
    if (w) w.characters = DEALS[i][4];
    const s = inst.findOne(function (n) { return n.name === "Deal / Store Name" && n.type === "TEXT"; });
    if (s) s.characters = DEALS[i][5];
    dealsTrack.appendChild(inst);
  }

  dealsPanel.appendChild(dealsHead);
  dealsPanel.appendChild(dealsTrack);

  const couponsPanel = frame("Panel / Top Coupons", "VERTICAL");
  couponsPanel.itemSpacing = 12;
  pad(couponsPanel, 20, 18);
  couponsPanel.cornerRadius = 20;
  couponsPanel.fills = [solid("#0a0f1e", 0.5)];
  couponsPanel.strokes = stroke(0.09);
  couponsPanel.strokeWeight = 1;
  couponsPanel.resize(572, 100);
  couponsPanel.primaryAxisSizingMode = "AUTO";
  couponsPanel.counterAxisSizingMode = "AUTO";

  const couponsHead = frame("Section / Coupons Head", "HORIZONTAL");
  couponsHead.primaryAxisAlignItems = "SPACE_BETWEEN";
  couponsHead.counterAxisAlignItems = "CENTER";
  couponsHead.layoutSizingHorizontal = "FILL";
  couponsHead.appendChild(await mkText("Section / Coupons Title", "Top Coupons", 22, "Bold", C.text));
  couponsHead.appendChild(await mkText("Section / Coupons Link", "View all coupons", 13, "Semi Bold", C.textSoft));
  couponsPanel.appendChild(couponsHead);

  for (let i = 0; i < COUPONS.length; i++) {
    const inst = couponComp.createInstance();
    inst.name = "Instance / Coupon " + (i + 1);
    const store = inst.findOne(function (n) { return n.name === "Coupon / Store" && n.type === "TEXT"; });
    if (store) store.characters = COUPONS[i][0];
    const offer = inst.findOne(function (n) { return n.name === "Coupon / Offer" && n.type === "TEXT"; });
    if (offer) offer.characters = COUPONS[i][1];
    const min = inst.findOne(function (n) { return n.name === "Coupon / Min" && n.type === "TEXT"; });
    if (min) min.characters = COUPONS[i][2];
    const code = inst.findOne(function (n) { return n.name === "Coupon / Code" && n.type === "TEXT"; });
    if (code) code.characters = COUPONS[i][3];
    const meta = inst.findOne(function (n) { return n.name === "Coupon / Meta" && n.type === "TEXT"; });
    if (meta) meta.characters = "Used " + COUPONS[i][4] + " times · Verified";
    couponsPanel.appendChild(inst);
    fillParent(inst);
  }

  commerce.appendChild(dealsPanel);
  commerce.appendChild(couponsPanel);

  hero.appendChild(search);
  hero.appendChild(dropdown);
  hero.appendChild(cats);
  hero.appendChild(commerce);
  fillParent(search);
  fillParent(dropdown);
  fillParent(commerce);

  parent.appendChild(hero);
  fillParent(hero);
}

async function buildFeatures(parent) {
  const wrap = frame("Section / Features", "VERTICAL");
  wrap.itemSpacing = 0;
  pad(wrap, 0, PAD);

  const grid = frame("Features / Grid", "HORIZONTAL");
  grid.itemSpacing = 18;
  grid.layoutSizingHorizontal = "FILL";

  for (let i = 0; i < FEATURES.length; i++) {
    const card = frame("Feature / " + FEATURES[i][0], "VERTICAL");
    pad(card, 24, 20);
    card.cornerRadius = 16;
    card.fills = [solid(C.glass, 0.55)];
    card.strokes = stroke(0.08);
    card.strokeWeight = 1;
    card.layoutSizingHorizontal = "FILL";
    const icon = frame("Feature / Icon", "HORIZONTAL");
    icon.resize(44, 44);
    icon.cornerRadius = 12;
    icon.fills = [solid(C.purple, 0.18)];
    icon.primaryAxisAlignItems = "CENTER";
    icon.counterAxisAlignItems = "CENTER";
    icon.appendChild(await mkText("Feature / Glyph", "◆", 18, "Regular", C.purple));
    card.appendChild(icon);
    card.appendChild(await mkText("Feature / Title", FEATURES[i][0], 15, "Bold", C.text));
    card.appendChild(await mkText("Feature / Text", FEATURES[i][1], 13, "Regular", C.textSoft, 280));
    grid.appendChild(card);
  }

  wrap.appendChild(grid);
  fillParent(grid);
  parent.appendChild(wrap);
  fillParent(wrap);
}

async function buildFooter(parent) {
  const wrap = frame("Section / Footer", "VERTICAL");
  pad(wrap, 0, PAD);

  const footer = frame("Footer / Stats Bar", "HORIZONTAL");
  footer.primaryAxisAlignItems = "SPACE_BETWEEN";
  footer.counterAxisAlignItems = "CENTER";
  pad(footer, 18, 24);
  footer.cornerRadius = 16;
  footer.fills = [solid(C.glass, 0.55)];
  footer.strokes = stroke(0.08);
  footer.strokeWeight = 1;
  footer.layoutSizingHorizontal = "FILL";

  const stats = frame("Footer / Stats", "HORIZONTAL");
  stats.itemSpacing = 28;
  for (let i = 0; i < FOOTER_STATS.length; i++) {
    const item = frame("Footer / Stat " + FOOTER_STATS[i][1], "HORIZONTAL");
    item.itemSpacing = 8;
    item.appendChild(await mkText("Footer / Value", FOOTER_STATS[i][0], 14, "Bold", C.text));
    item.appendChild(await mkText("Footer / Label", FOOTER_STATS[i][1], 12, "Regular", C.textSoft));
    stats.appendChild(item);
  }

  const trust = frame("Footer / Trustpilot", "HORIZONTAL");
  trust.itemSpacing = 8;
  trust.appendChild(await mkText("Footer / Excellent", "Excellent", 12, "Bold", C.text));
  trust.appendChild(await mkText("Footer / Stars", "★★★★★", 12, "Regular", C.green));
  trust.appendChild(await mkText("Footer / Reviews", "4,827 reviews on Trustpilot", 12, "Regular", C.textSoft));

  footer.appendChild(stats);
  footer.appendChild(trust);
  wrap.appendChild(footer);
  fillParent(footer);
  parent.appendChild(wrap);
  fillParent(wrap);
}

async function run() {
  await ensureFont("Regular");
  await ensureFont("Medium");
  await ensureFont("Semi Bold");
  await ensureFont("Bold");

  const homepage = figma.currentPage;
  homepage.name = "Homepage";

  for (let i = homepage.children.length - 1; i >= 0; i--) {
    homepage.children[i].remove();
  }

  let compPage = figma.root.children.find(function (p) { return p.name === "Components"; });
  if (!compPage) {
    compPage = figma.createPage();
    compPage.name = "Components";
  } else {
    for (let i = compPage.children.length - 1; i >= 0; i--) {
      compPage.children[i].remove();
    }
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  if (collections.length === 0) {
    await createTokens();
  }

  const dealComp = await createDealComponent(compPage);
  const couponComp = await createCouponComponent(compPage);

  const wrapper = frame("Homepage / Desktop 1920", "VERTICAL");
  wrapper.resize(W, 100);
  wrapper.layoutSizingHorizontal = "FIXED";
  wrapper.itemSpacing = 0;
  wrapper.fills = [solid(C.bgDeep)];
  wrapper.x = 0;
  wrapper.y = 0;

  await buildHeader(wrapper);
  await buildHeroBlock(wrapper, dealComp, couponComp);
  await buildFeatures(wrapper);
  await buildFooter(wrapper);

  homepage.appendChild(wrapper);
  figma.viewport.scrollAndZoomIntoView([wrapper]);
  figma.closePlugin("ZORINO homepage built successfully.");
}

run();
