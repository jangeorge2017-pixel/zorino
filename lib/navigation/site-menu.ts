/** Navigation labels only — not product catalogs. Products come from live AliExpress. */
const NAV_CATEGORIES = [
  { slug: "phones", name: "Phones" },
  { slug: "laptops", name: "Laptops" },
  { slug: "gaming", name: "Gaming" },
  { slug: "tvs", name: "TVs" },
  { slug: "home", name: "Home" },
  { slug: "wearables", name: "Wearables" },
] as const;

const NAV_STORES = [{ slug: "aliexpress", name: "AliExpress" }] as const;

export type NavMenuItem = {
  label: string;
  href: string;
  description?: string;
  children?: NavMenuItem[];
};

export type SiteNavMenuSection = {
  id: string;
  label: string;
  href: string;
  description: string;
  children: NavMenuItem[];
};

function categorySubItems(slug: string, name: string): NavMenuItem[] {
  return [
    { label: `All ${name}`, href: `/categories/${slug}` },
    { label: "Top Rated", href: `/categories/${slug}?sort=rating` },
    { label: "On Sale", href: `/categories/${slug}?filter=deals` },
    {
      label: "Browse Products",
      href: `/products?category=${slug}`,
      children: [
        { label: "New Arrivals", href: `/products?category=${slug}&sort=new` },
        { label: "Best Sellers", href: `/products?category=${slug}&sort=popular` },
        { label: "Price Drops", href: `/products?category=${slug}&sort=price_drop` },
      ],
    },
  ];
}

export const SITE_NAV_MENUS: SiteNavMenuSection[] = [
  {
    id: "deals",
    label: "Deals",
    href: "/deals",
    description: "Hot discounts and limited-time offers",
    children: [
      { label: "All Deals", href: "/deals", description: "Browse every active deal" },
      { label: "Flash Sales", href: "/deals?filter=flash", description: "Ending within 24 hours" },
      { label: "Ending Soon", href: "/deals?sort=ending_soon", description: "Last chance savings" },
      { label: "Price Drops", href: "/deals?filter=drops", description: "Recently reduced prices" },
      {
        label: "By Category",
        href: "/deals",
        children: NAV_CATEGORIES.map((cat) => ({
          label: cat.name,
          href: `/deals?category=${cat.slug}`,
          children: [
            { label: `${cat.name} Deals`, href: `/deals?category=${cat.slug}` },
            { label: `${cat.name} Products`, href: `/products?category=${cat.slug}` },
          ],
        })),
      },
    ],
  },
  {
    id: "coupons",
    label: "Coupons",
    href: "/coupons",
    description: "Verified promo codes from partner stores",
    children: [
      { label: "All Coupons", href: "/coupons", description: "Every verified code" },
      { label: "Most Popular", href: "/coupons?sort=popular", description: "Top used this week" },
      { label: "New Today", href: "/coupons?filter=new", description: "Freshly added codes" },
      {
        label: "By Store",
        href: "/coupons",
        children: NAV_STORES.map((store) => ({
          label: store.name,
          href: `/coupons?store=${store.slug}`,
          children: [
            { label: `${store.name} Coupons`, href: `/coupons?store=${store.slug}` },
            { label: `${store.name} Deals`, href: `/deals?store=${store.slug}` },
            { label: `Shop ${store.name}`, href: `/stores/${store.slug}` },
          ],
        })),
      },
    ],
  },
  {
    id: "compare",
    label: "Compare",
    href: "/compare",
    description: "Side-by-side price comparison",
    children: [
      { label: "Compare Products", href: "/compare", description: "Multi-store price tables" },
      { label: "Lowest Prices", href: "/compare?filter=lowest", description: "Best price highlights" },
      { label: "All Products", href: "/products", description: "Browse before you compare" },
      {
        label: "Popular Comparisons",
        href: "/compare",
        children: [
          {
            label: "Phones",
            href: "/compare?category=phones",
            children: [
              { label: "iPhone Deals", href: "/search?q=iphone" },
              { label: "Samsung Galaxy", href: "/search?q=galaxy" },
            ],
          },
          {
            label: "Laptops",
            href: "/compare?category=laptops",
            children: [
              { label: "MacBook", href: "/search?q=macbook" },
              { label: "Gaming Laptops", href: "/search?q=gaming+laptop" },
            ],
          },
          {
            label: "Gaming",
            href: "/compare?category=gaming",
            children: [
              { label: "Consoles", href: "/search?q=console" },
              { label: "Controllers", href: "/search?q=controller" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "categories",
    label: "Categories",
    href: "/categories",
    description: "Shop by department",
    children: [
      { label: "All Categories", href: "/categories" },
      { label: "All Products", href: "/products" },
      ...NAV_CATEGORIES.map((cat) => ({
        label: cat.name,
        href: `/categories/${cat.slug}`,
        description: `Live AliExpress ${cat.name.toLowerCase()}`,
        children: categorySubItems(cat.slug, cat.name),
      })),
    ],
  },
  {
    id: "stores",
    label: "Stores",
    href: "/stores",
    description: "Partner marketplaces and retailers",
    children: [
      { label: "All Stores", href: "/stores" },
      ...NAV_STORES.map((store) => ({
        label: store.name,
        href: `/stores/${store.slug}`,
        description: "Live AliExpress Affiliates catalog",
        children: [
          { label: `Shop ${store.name}`, href: `/stores/${store.slug}` },
          { label: `${store.name} Deals`, href: `/deals?store=${store.slug}` },
          { label: `${store.name} Products`, href: `/products?store=${store.slug}` },
        ],
      })),
    ],
  },
  {
    id: "blog",
    label: "Blog",
    href: "/blog",
    description: "Shopping tips and deal guides",
    children: [
      { label: "All Articles", href: "/blog" },
      { label: "Featured", href: "/blog?filter=featured" },
      {
        label: "Topics",
        href: "/blog",
        children: [
          { label: "Deals & Discounts", href: "/blog?category=deals" },
          { label: "Shopping Tips", href: "/blog?category=tips" },
          { label: "Product Guides", href: "/blog?category=guides" },
        ],
      },
      { label: "Latest Articles", href: "/blog" },
    ],
  },
];
