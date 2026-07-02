import http from "node:http";

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () =>
          resolve({ status: res.statusCode, body, headers: res.headers }),
        );
      })
      .on("error", reject);
  });
}

const BASE = process.env.HOMEPAGE_URL ?? "http://localhost:3000";

const home = await get(`${BASE}/`);
const hrefs = [
  ...home.body.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g),
].map((match) => match[1]);

let combined = "";
for (const href of hrefs) {
  const url = href.startsWith("http") ? href : `${BASE}${href}`;
  const css = await get(url);
  combined += css.body;
}

const checks = {
  displayContentsOnLinks: combined.includes(".zh-nav__links") && combined.includes("display:contents"),
  nav39d5ff: /39d5ff/i.test(combined),
  titleFfa31a: /ffa31a/i.test(combined),
  featuredPaddingZeroTop:
    combined.includes(".zh-featured-brands.zh-panel") &&
    /padding:\s*0\s+18px\s+18px/.test(combined),
  profileMarginAuto:
    combined.includes(".zh-nav__profile") && combined.includes("margin-left:auto"),
  bg06080f: /06080f/i.test(combined),
  navInnerGap10: combined.includes("--zh-nav-item-gap") || combined.includes("gap:var(--zh-nav-item-gap"),
};

console.log("IMPORT CHAIN:");
console.log("- app/[locale]/page.tsx -> ZorinoHomePage");
console.log("- ZorinoHomePage imports zorino-home.css, homepage-surface.css");
console.log("- ZorinoHomeNav imports nav.css");
console.log("- ZorinoHomeFeaturedCouponBrands imports featured-coupon-brands.css");
console.log("\nSERVED CSS CHECKS:", JSON.stringify(checks, null, 2));

console.log("\n.zh-featured-brands.zh-panel rules:");
for (const match of combined.matchAll(/\.zh-featured-brands\.zh-panel\{[^}]+\}/g)) {
  console.log(match[0]);
}

console.log("\n.zh-nav__inner rules:");
for (const match of combined.matchAll(/\.zh-nav__inner\{[^}]+\}/g)) {
  console.log(match[0]);
}

console.log("\n.zh-page__background rules:");
for (const match of combined.matchAll(/\.zh-page__background[^{]*\{[^}]+\}/g)) {
  console.log(match[0].slice(0, 220));
}
