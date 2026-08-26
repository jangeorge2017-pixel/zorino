/**
 * Amazon Egypt seed-link catalog.
 * Each entry is a real Amazon.eg product URL with the zorinoeg-21 affiliate tag.
 * No product data is fabricated — these are exact URLs that resolve on amazon.eg.
 */

export type AmazonEgSeedLink = {
  id: string;
  title: string;
  affiliateUrl: string;
};

const TAG = "zorinoeg-21";
const DOMAIN = "https://www.amazon.eg";

function eg(asin: string, title: string): AmazonEgSeedLink {
  return {
    id: `eg-${asin}`,
    title,
    affiliateUrl: `${DOMAIN}/dp/${asin}?tag=${TAG}`,
  };
}

export const AMAZON_EG_SEED_LINKS: AmazonEgSeedLink[] = [
  eg("B0CHX3QBCH", "Apple iPhone 15"),
  eg("B0D1XD1ZV3", "Apple iPhone 16"),
  eg("B0D5CRCFBW", "Samsung Galaxy S24 Ultra"),
  eg("B0CX23V2ZK", "Samsung Galaxy S23 FE"),
  eg("B0BDHWDR12", "AirPods Pro 2nd Gen"),
  eg("B0CHWRXH8B", "MacBook Air M3"),
  eg("B0D77BX4SN", "Apple iPad 10th Gen"),
  eg("B09V3KXJPB", "Fire TV Stick 4K Max"),
  eg("B08N5WRWNW", "Echo Dot 5th Gen"),
  eg("B09B8V1LZ3", "Echo Show 8"),
  eg("B0CS5WV4YJ", "Kindle Paperwhite"),
  eg("B0D67CJ6G4", "Blink Mini 2"),
  eg("B0DGH2SLDL", "Ring Video Doorbell"),
  eg("B0B3C5WV4Y", "Anker Soundcore Speaker"),
  eg("B09JQL3NWT", "Apple Watch SE"),
  eg("B0CHX3QD6M", "iPad Air M2"),
  eg("B0D5CRFQ7C", "Galaxy Tab S9 FE"),
  eg("B0CXLM5FPR", "AirPods 3rd Gen"),
  eg("B0BDHDR46M", "Bose QuietComfort 45"),
  eg("B0DGH1BMQD", "Ring Alarm Security Kit"),
];
