// app/components/RecordProductView.tsx
"use client";
import { useEffect } from "react";
import { recordRecentlyViewed } from "@/app/utils/recentlyViewed";

// Renders nothing -- just logs this product into the visitor's
// localStorage-based "recently viewed" list on mount.
export default function RecordProductView({
  id,
  name,
  price,
  image_url,
  category,
}: {
  id: string | number;
  name: string;
  price: number;
  image_url: string;
  category?: string | null;
}) {
  useEffect(() => {
    recordRecentlyViewed({ id, name, price, image_url, category });
  }, [id, name, price, image_url, category]);

  return null;
}
