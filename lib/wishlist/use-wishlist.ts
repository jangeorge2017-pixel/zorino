"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readWishlist,
  removeWishlistItem,
  subscribeToWishlist,
  toggleWishlistItem,
} from "@/lib/wishlist/storage";
import type { WishlistSnapshotItem } from "@/lib/wishlist/types";

/** React binding for the guest wishlist storage. */
export function useWishlist() {
  const [items, setItems] = useState<WishlistSnapshotItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setItems(readWishlist());
    sync();
    setReady(true);
    return subscribeToWishlist(sync);
  }, []);

  const ids = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  const toggle = useCallback((item: Omit<WishlistSnapshotItem, "addedAt">) => {
    return toggleWishlistItem(item);
  }, []);

  const remove = useCallback((id: string) => {
    removeWishlistItem(id);
  }, []);

  return { items, ready, has, toggle, remove };
}
