import type { WishlistSnapshotItem } from "@/lib/wishlist/types";

/**
 * Guest wishlist storage.
 *
 * Stores full item snapshots (not bare ids) so the wishlist page can render
 * real products without a database round-trip. Local to the browser — no
 * fabricated data, only items the visitor actually saved.
 */

const STORAGE_KEY = "zorino_wishlist_guest_v1";
const CHANGE_EVENT = "zorino:wishlist-changed";
const MAX_ITEMS = 100;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readWishlist(): WishlistSnapshotItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WishlistSnapshotItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as WishlistSnapshotItem).id === "string" &&
        typeof (item as WishlistSnapshotItem).price === "number",
    );
  } catch {
    return [];
  }
}

function writeWishlist(items: WishlistSnapshotItem[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // Storage full or unavailable — wishlist stays in-memory only.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function isWishlisted(id: string): boolean {
  return readWishlist().some((item) => item.id === id);
}

/** Adds or removes an item. Returns true when the item was added. */
export function toggleWishlistItem(item: Omit<WishlistSnapshotItem, "addedAt">): boolean {
  const items = readWishlist();
  const exists = items.some((entry) => entry.id === item.id);
  if (exists) {
    writeWishlist(items.filter((entry) => entry.id !== item.id));
    return false;
  }
  writeWishlist([{ ...item, addedAt: new Date().toISOString() }, ...items]);
  return true;
}

export function removeWishlistItem(id: string): void {
  writeWishlist(readWishlist().filter((entry) => entry.id !== id));
}

export function subscribeToWishlist(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
