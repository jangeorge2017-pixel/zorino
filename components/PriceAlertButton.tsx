"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";

const STORAGE_KEY = "zorino_price_alerts_guest";

function readAlerts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeAlerts(ids: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

type PriceAlertButtonProps = {
  productId: string;
};

export default function PriceAlertButton({ productId }: PriceAlertButtonProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(readAlerts().includes(productId));
  }, [productId]);

  const toggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const ids = readAlerts();
      const next = ids.includes(productId)
        ? ids.filter((id) => id !== productId)
        : [...ids, productId];
      writeAlerts(next);
      setActive(next.includes(productId));
    },
    [productId],
  );

  return (
    <button
      type="button"
      className={`product-alert-btn${active ? " is-active" : ""}`}
      aria-label={active ? "Remove price alert" : "Set price alert"}
      aria-pressed={active}
      onClick={toggle}
    >
      <Bell size={15} fill={active ? "currentColor" : "none"} />
      <span>Price Alert</span>
    </button>
  );
}
