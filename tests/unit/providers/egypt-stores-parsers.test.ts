import { describe, expect, it } from "vitest";
import { parse2BHtml } from "@/lib/integrations/egypt-stores/adapters/twob";
import { parseBtechHtml } from "@/lib/integrations/egypt-stores/adapters/btech";
import { parseCarrefourHtml } from "@/lib/integrations/egypt-stores/adapters/carrefour";
import { parseDubaiPhoneHtml } from "@/lib/integrations/egypt-stores/adapters/dubaiphone";
import { parseEldokanProducts } from "@/lib/integrations/egypt-stores/adapters/eldokan";
import { parseJumiaHtml } from "@/lib/integrations/egypt-stores/adapters/jumia";
import { parseNoonHtml } from "@/lib/integrations/egypt-stores/adapters/noon";
import { parseRaneenProducts } from "@/lib/integrations/egypt-stores/adapters/raneen";
import { parseTemuHtml } from "@/lib/integrations/egypt-stores/adapters/temu";

describe("Egyptian store parsers", () => {
  it("parses 2B Magento product cards", () => {
    const html = `
      <li class="item product product-item" data-product-id="2b-1">
        <img class="product-image-photo" src="/media/phone.jpg" />
        <a class="product-item-link" href="/en/iphone.html">iPhone 15</a>
        <span data-price-amount="50000" data-price-type="finalPrice"></span>
        <span data-price-amount="60000" data-price-type="oldPrice"></span>
      </li>`;
    const [item] = parse2BHtml(html);
    expect(item).toMatchObject({
      providerId: "twob",
      externalId: "2b-1",
      title: "iPhone 15",
      price: 50000,
      originalPrice: 60000,
      currency: "EGP",
    });
  });

  it("parses B.TECH escaped items JSON", () => {
    const html = `<script>self.__next_f.push([1,"{\\"items\\":[{\\"variant_id\\":\\"bt-1\\",\\"name\\":\\"iPhone 15\\",\\"slug\\":\\"iphone-15\\",\\"thumbnail_url\\":\\"p/1.jpg\\",\\"offer_id\\":\\"offer-1\\",\\"price\\":{\\"final_price\\":45000,\\"base_price\\":50000},\\"is_in_stock\\":true}]}"])</script>`;
    const [item] = parseBtechHtml(html);
    expect(item).toMatchObject({
      providerId: "btech",
      externalId: "bt-1",
      title: "iPhone 15",
      price: 45000,
      originalPrice: 50000,
      imageUrl: "https://media.btech.com/catalogs/p/1.jpg",
    });
    expect(item.productUrl).toContain("/en/p/iphone-15?offering_id=offer-1");
  });

  it("parses Carrefour flight product objects", () => {
    const html = `{\\"imageUrl\\":\\"https://cdn.mafrservices.com/iphone.jpg\\",\\"productId\\":\\"688907\\",\\"productName\\":\\"iPhone 15\\",\\"sellingPrice\\":114999,\\"markedPrice\\":124999,\\"currency\\":\\"EGP\\",\\"productUrl\\":\\"/mafegy/en/iphone/p/688907\\"}`;
    const [item] = parseCarrefourHtml(html);
    expect(item).toMatchObject({
      providerId: "carrefour",
      externalId: "688907",
      price: 114999,
      originalPrice: 124999,
      currency: "EGP",
    });
  });

  it("parses Noon product boxes", () => {
    const html = `
      <div data-qa="plp-product-box">
        <a href="/egypt-en/iphone-15/N12345678A/p/">
          <img class="_productImage_abc" src="https://f.nooncdn.com/p/iphone.jpg" alt="iPhone 15 - Image 1" />
        </a>
        <div class="_sellingPrice_1"><strong>45,000</strong></div>
        <span class="_oldPrice_1">50,000</span>
      </div>`;
    const [item] = parseNoonHtml(html);
    expect(item).toMatchObject({
      providerId: "noon",
      externalId: "N12345678A",
      title: "iPhone 15",
      price: 45000,
      originalPrice: 50000,
    });
  });

  it("parses Jumia catalog cards from the visible EGP price, not USD analytics", () => {
    const html = `
      <article class="prd _fb col c-prd" data-moengage-product_image="https://www.jumia.com.eg/iphone.jpg">
        <a class="core" href="/iphone-15.html" data-gtm-id="J1" data-gtm-name="iPhone 15" data-gtm-price="762.71" data-ga4-discount="84.75"></a>
        <div class="prc _inl">EGP 45,000.00</div>
        <div class="old">EGP 50,000.00</div>
      </article>`;
    const [item] = parseJumiaHtml(html);
    expect(item).toMatchObject({
      providerId: "jumia",
      externalId: "J1",
      title: "iPhone 15",
      price: 45000,
      originalPrice: 50000,
    });
  });

  it("drops Jumia cards that only expose the USD analytics price", () => {
    const html = `
      <article class="prd _fb col c-prd" data-moengage-product_image="https://www.jumia.com.eg/iphone.jpg">
        <a class="core" href="/iphone-15.html" data-gtm-id="J1" data-gtm-name="iPhone 15" data-gtm-price="762.71"></a>
      </article>`;
    expect(parseJumiaHtml(html)).toHaveLength(0);
  });

  it("parses Raneen Vertex products", () => {
    const [item] = parseRaneenProducts([
      {
        id: "R1",
        title: "iPhone 15",
        url: "/en/iphone-15",
        imageUrl: "/media/iphone.jpg",
        price: 45000,
        originalPrice: 50000,
        currencyCode: "EGP",
        availability: "IN_STOCK",
      },
    ]);
    expect(item).toMatchObject({
      providerId: "raneen",
      externalId: "R1",
      price: 45000,
      originalPrice: 50000,
      inStock: true,
    });
  });

  it("parses Shopify suggest products for El Dokan", () => {
    const [item] = parseEldokanProducts([
      {
        handle: "iphone-15",
        title: "iPhone 15",
        url: "/products/iphone-15",
        image: "https://cdn.shopify.com/iphone.jpg",
        price: "EGP 45,000.00",
        compare_at_price: "EGP 50,000.00",
        available: true,
      },
    ]);
    expect(item).toMatchObject({
      providerId: "eldokan",
      title: "iPhone 15",
      price: 45000,
      originalPrice: 50000,
    });
  });

  it("parses Temu embedded rawData products", () => {
    const html = `<script>window.rawData={"props":{"list":[{"goodsId":"T1","goodsName":"iPhone 15","linkUrl":"goods.html?goods_id=T1","hdThumbUrl":"https://img.kwcdn.com/iphone.jpg","priceInfo":{"price":"45000","marketPrice":"50000"}}]}}</script>`;
    const [item] = parseTemuHtml(html);
    expect(item).toMatchObject({
      providerId: "temu",
      externalId: "T1",
      title: "iPhone 15",
      price: 45000,
    });
  });

  it("parses Dubai Phone cards and decodes next/image sources", () => {
    const html = `
      <a href="/en/shop/iphone-15">
        <article class="nf-product-card">
          <img src="/_next/image?url=https%3A%2F%2Fcdn.dubaiphone.net%2Fiphone.jpg&w=640" alt="iPhone 15" />
          <span>45,000 EGP</span>
        </article>
      </a>`;
    const [item] = parseDubaiPhoneHtml(html);
    expect(item).toMatchObject({
      providerId: "dubaiphone",
      title: "iPhone 15",
      price: 45000,
      imageUrl: "https://cdn.dubaiphone.net/iphone.jpg",
    });
  });
});
