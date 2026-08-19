/**
 * Visual snapshot of https://zorino.org homepage commerce data.
 * Used for local/dev fallbacks so Mobile UI matches production rendering.
 */
import { STORE_LOGOS } from "@/lib/assets";
import type { HomepageSectionProducts } from "@/lib/data/homepage";
import type { TrendingDealCard } from "@/lib/types/entities";
import type { ZhCoupon, ZhDeal, ZhFooterStat, ZhHeroStat, ZhOrbitCard } from "@/lib/zorino-home/content";

const AE = STORE_LOGOS.aliExpress;

function deal(input: {
  id: string;
  name: string;
  imageSrc: string;
  discount: number;
  price: number;
  originalPrice: number;
  rating?: number;
  reviews?: number;
  updatedMins?: number;
}): ZhDeal {
  const { price, originalPrice } = input;
  return {
    id: input.id,
    name: input.name,
    imageSrc: input.imageSrc,
    discount: input.discount,
    rating: input.rating ?? 0,
    reviews: input.reviews ?? 0,
    price,
    originalPrice,
    store: "AliExpress",
    storeLogoSrc: AE,
    storeInitial: "AE",
    updatedMins: input.updatedMins ?? 2,
    priceHistory: [originalPrice, price],
  };
}

function cardFromDeal(d: ZhDeal, idPrefix?: string): TrendingDealCard {
  return {
    id: idPrefix ? `${idPrefix}-${d.id}` : d.id,
    name: d.name,
    imageSrc: d.imageSrc,
    emoji: "🛍️",
    discount: d.discount,
    rating: d.rating,
    reviews: d.reviews,
    price: d.price,
    originalPrice: d.originalPrice,
    store: d.store,
    storeLogoSrc: d.storeLogoSrc,
    storeInitial: d.storeInitial,
    updatedMins: d.updatedMins,
    priceHistory: d.priceHistory,
  };
}

export const PROD_HERO_STATS: ZhHeroStat[] = [
  { icon: "stores", value: "10+", label: "Stores", tone: "purple" },
  { icon: "products", value: "772+", label: "Products", tone: "blue" },
  { icon: "coupons", value: "4", label: "Coupons", tone: "green" },
  { icon: "tracking", value: "Real-time", label: "Price Tracking", tone: "violet" },
];

export const PROD_FOOTER_STATS: ZhFooterStat[] = [
  { icon: "stores", value: "10+", label: "Stores" },
  { icon: "products", value: "772+", label: "Products" },
  { icon: "coupons", value: "4", label: "Coupons" },
  { icon: "users", value: "0", label: "Happy Users" },
];

export const PROD_ORBIT_CARDS: ZhOrbitCard[] = [
  {
    slot: "top",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sa1e7155d44be44679bc70006d29217d2P.jpg",
    discount: "-84%",
    price: "$54",
    original: "$340",
  },
  {
    slot: "left",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sfcc570d915e64d2b9d79ea0d8e2b2c90U.jpg",
    discount: "-80%",
    price: "$27",
    original: "$133",
  },
  {
    slot: "upper-right",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sf0418f1b6cc14802bb85ffa967c40bcaL.jpg",
    discount: "-76%",
    price: "$147",
    original: "$611",
  },
  {
    slot: "right",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Scf32fefdf7eb43cf98644f25515fc95fE.jpg",
    discount: "-76%",
    price: "$151",
    original: "$631",
  },
];

export const PROD_TRENDING_DEALS: ZhDeal[] = [
  deal({
    id: "ae-fidget-keyboard",
    name: "Quality Assurance 2PCS Keyboard Fidget Toy, Keyboard Clicker Fidget Toy, Clicky Keychain Stress Relief Sensory Toys Goodies Bag",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sa1e7155d44be44679bc70006d29217d2P.jpg",
    discount: 84,
    price: 54.35,
    originalPrice: 339.67,
  }),
  deal({
    id: "ae-cnc-keyboard",
    name: "CNC operation panel manual keyboard sheet membrane for Xiehong HCMC-2082 CNC machine tool",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sfcc570d915e64d2b9d79ea0d8e2b2c90U.jpg",
    discount: 80,
    price: 26.63,
    originalPrice: 133.13,
  }),
  deal({
    id: "ae-rv-camera",
    name: "RV Backup Camera Wireless Easy Install: Plug & Play for Furrion Pre-Wired RVs - 7″ HD Touch Key Monitor, 1080P DVR, 4-Channel Sp",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sf0418f1b6cc14802bb85ffa967c40bcaL.jpg",
    discount: 76,
    price: 146.68,
    originalPrice: 611.17,
  }),
  deal({
    id: "ae-security-monitor",
    name: "Security Camera Monitor Screen, 22 Inch 1080P Thin LED PC Monitor with HDMI VGA Built in Speaker Compatible with CCTV Security D",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Scf32fefdf7eb43cf98644f25515fc95fE.jpg",
    discount: 76,
    price: 151.46,
    originalPrice: 631.1,
  }),
  deal({
    id: "ae-solar-backup",
    name: 'X5 Magnetic Solar Wireless Backup Camera with 5" HD Monitor, 1-Min Zero-Install for RV Truck Trailer, 320ft Signal Range, 15000m',
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/S35b0fa3ca6124e3081120422817a7781E.jpg",
    discount: 76,
    price: 153.06,
    originalPrice: 637.75,
  }),
  deal({
    id: "ae-towable-rv",
    name: 'Wireless Backup Camera for Towable-RV: 1-Second Magnetic No Wiring Long Distance Signal for Thor/Forest River Series RVs - 7.3"',
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sf8a33e9ba55f4e72bfd5e5b47ab175bbz.jpg",
    discount: 76,
    price: 220.03,
    originalPrice: 916.79,
  }),
  deal({
    id: "ae-xcover6",
    name: "Samsung / Galaxy XCover6 Pro / SM-G736U / * / Unlocked / 128GB / Fair Includes Charging Cable",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/S84082a0508d046eea434f2a02ed960e2n.jpg",
    discount: 75,
    price: 172.93,
    originalPrice: 698.71,
  }),
  deal({
    id: "ae-lightbulb-cam",
    name: "Light Bulb 1080P Security Wireless Camera Wifi Smart for home surveillance Screw into the E27 light bulb socket Spotlight Alarm",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sb2e71736b4d14196ad183ee1943377b9e.jpg",
    discount: 75,
    price: 99.28,
    originalPrice: 397.13,
  }),
];

const NEW_ARRIVALS: ZhDeal[] = [
  deal({
    id: "ae-iphone-se-64-good",
    name: "Apple iPhone SE (2nd Gen) A2275 (Fully Unlocked) 64GB Black - Refurbished Good Condition",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Aeaae5d3db4c94e63be1dacd277235e625.jpg",
    discount: 69,
    price: 113.12,
    originalPrice: 364.89,
    updatedMins: 1,
  }),
  deal({
    id: "ae-iphone-se-64-excellent",
    name: "Apple iPhone SE (2nd Gen) A2275 (Fully Unlocked) 64GB Black - Refurbished Excellent Condition",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Aeaae5d3db4c94e63be1dacd277235e625.jpg",
    discount: 69,
    price: 118.5,
    originalPrice: 382.27,
    updatedMins: 1,
  }),
  deal({
    id: "ae-iphone-se-128",
    name: "Apple iPhone SE (2nd Gen) A2275 (Fully Unlocked) 128GB Black - Refurbished Acceptabe Condition",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Aeaae5d3db4c94e63be1dacd277235e625.jpg",
    discount: 69,
    price: 118.5,
    originalPrice: 382.27,
    updatedMins: 1,
  }),
  deal({
    id: "ae-iphone-x",
    name: "Apple iPhone X A1865 (Fully Unlocked) 256GB Silver - Refurbished Excellent Condition",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/A5bda68b4488b45ecafa2ac038ef0f974w.jpg",
    discount: 69,
    price: 161.6,
    originalPrice: 521.29,
    updatedMins: 1,
  }),
];

const TOP_RATED: ZhDeal[] = [
  deal({
    id: "ae-toocki",
    name: "Toocki Bluetooth 5.3 Earphone Wireless HiFi In-ear Headphones Touch Control With Mic Earbuds Sports Noise Reduction Headsets",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/S5bbb8f5a314e437983988a6b261f7d7b0.jpg",
    discount: 50,
    price: 8.79,
    originalPrice: 17.59,
    rating: 5,
    reviews: 55,
  }),
  deal({
    id: "ae-i9-laptop",
    name: "New Intel Core i9 10980HK 15.6inch laptop 16GB RAM 2TB SSD Windows 11 Por Office PC Notebook computer Portable Gaming laptops",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sa5f8025c56cf47dd878e9db241457e092.jpg",
    discount: 30,
    price: 320.16,
    originalPrice: 457.37,
    rating: 5,
    reviews: 44,
  }),
  deal({
    id: "ae-cable-org",
    name: "Cable Organizer Cord Management Wire Holder Flexible USB Cable Winder Tidy Silicone Clips For Mouse Keyboard Earphone Protector",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/S4ebc9ff421a34c728e646a820d894b54t.jpg",
    discount: 51,
    price: 0.78,
    originalPrice: 1.6,
    rating: 5,
    reviews: 44,
  }),
  deal({
    id: "ae-cheese-clicker",
    name: "3D Printed Mini Cheese Keyboard Clicker Keychain Fidget Button Stress Relief Keyring Toy Gift Keychain Accessory",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sfa54f463f751400fb8869424f74293757.jpg",
    discount: 50,
    price: 1.96,
    originalPrice: 3.92,
    rating: 5,
    reviews: 40,
  }),
];

const EDITORS_PICKS: ZhDeal[] = [
  deal({
    id: "ae-ai-glasses",
    name: "2026 AI Smart Glasses 8K Remote Control Touch Photo Camera Recording Voice Assistant Translator Wireless Bluetooth Sunglasses",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/S72045b84b1684596b9fa5deb280a5ed0r.jpg",
    discount: 45,
    price: 35.59,
    originalPrice: 64.71,
    rating: 5,
    reviews: 23,
  }),
  deal({
    id: "ae-mini-cable",
    name: "5/50Pcs Mini Cable Organizer Silicone USB Cable Winder Management Clips for Mouse Keyboard Earphone Headset Wire Holders",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sb99e522d80424a41bdc0583357bbd4cag.jpg",
    discount: 51,
    price: 0.9,
    originalPrice: 1.84,
    rating: 5,
    reviews: 21,
  }),
  deal({
    id: "ae-psm3000",
    name: "Stereo In-Ear Monitor System G-MARK PSM3000 Wireless Stage Return For Guitar Studio Band Performance Show",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sa453d3bfa12944a79fa150ff6b238256A.jpg",
    discount: 54,
    price: 97.4,
    originalPrice: 211.75,
    rating: 5,
    reviews: 13,
  }),
  deal({
    id: "ae-ultra-thin-laptop",
    name: "2026 14.1 Inch Ultra Thin Laptop 2026 Win11 Intel I9-9880H DDR4 16GB/32GB RAM 2TB SSD Portable Business Notebook",
    imageSrc: "https://ae-pic-a1.aliexpress-media.com/kf/Sc98545b16570489bbd5e610217c159cfg.jpg",
    discount: 50,
    price: 0.85,
    originalPrice: 1.7,
    rating: 5,
    reviews: 7,
  }),
];

export const PROD_TOP_COUPONS: ZhCoupon[] = [
  {
    id: "amazon",
    store: "Amazon",
    storeLogoSrc: STORE_LOGOS.amazon,
    storeInitial: "a",
    offer: "10% OFF Sitewide",
    minSpend: "Min spend $50",
    code: "SAVE10",
    usedTimes: 25_000,
    verified: true,
  },
  {
    id: "nike",
    store: "Nike",
    storeLogoSrc: STORE_LOGOS.nike,
    storeInitial: "N",
    offer: "20% OFF Full Price Items",
    minSpend: "No minimum",
    code: "NIKE20",
    usedTimes: 9_800,
    verified: true,
  },
  {
    id: "noon",
    store: "Noon",
    storeLogoSrc: STORE_LOGOS.noon,
    storeInitial: "N",
    offer: "15% OFF Electronics",
    minSpend: "Min spend $100",
    code: "NOON15",
    usedTimes: 8_700,
    verified: true,
  },
  {
    id: "aliexpress",
    store: "AliExpress",
    storeLogoSrc: STORE_LOGOS.aliExpress,
    storeInitial: "AE",
    offer: "$50 OFF Orders $200+",
    minSpend: "Min spend $200",
    code: "AE50OFF",
    usedTimes: 5_600,
    verified: true,
  },
];

/** Flash + Price Drops match the top trending products on production. */
export function getProductionSectionProducts(): HomepageSectionProducts {
  const top4 = PROD_TRENDING_DEALS.slice(0, 4);
  return {
    flash: top4.map((d) => cardFromDeal(d, "flash")),
    priceDrops: top4.map((d) => cardFromDeal(d, "drop")),
    newArrivals: NEW_ARRIVALS.map((d) => cardFromDeal(d, "new")),
    topRated: TOP_RATED.map((d) => cardFromDeal(d, "rated")),
    editorsPicks: EDITORS_PICKS.map((d) => cardFromDeal(d, "pick")),
  };
}
