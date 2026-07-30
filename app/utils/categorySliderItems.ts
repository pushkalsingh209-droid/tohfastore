// app/utils/categorySliderItems.ts
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

// One randomly chosen product per category, for the "Shop by Category"
// slider -- re-rolled on every request (used only from fully dynamic
// routes), so a reload shows a different product per category each time.
export interface CategorySliderItem {
  name: string;
  product: { id: number; name: string; image_url: string };
}

export async function getCategorySliderItems(): Promise<CategorySliderItem[]> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, image_url, category")
      .not("category", "is", null)
      .not("image_url", "is", null);
    if (error || !data) return [];

    const byCategory = new Map<string, { id: number; name: string; image_url: string }[]>();
    for (const p of data as any[]) {
      if (!p.category) continue;
      if (!byCategory.has(p.category)) byCategory.set(p.category, []);
      byCategory.get(p.category)!.push(p);
    }

    return Array.from(byCategory.entries())
      .map(([name, products]) => ({
        name,
        product: products[Math.floor(Math.random() * products.length)],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
