// app/components/AddToCartButton.tsx
"use client";
import { useCart } from "@/app/context/CartContext";

export default function AddToCartButton({ product }: { product: any }) {
  const { addToCart, cart } = useCart();

  const stock = Number(product.inventory) || 0;
  const cartQty = cart?.find((item: any) => item.id === product.id)?.quantity || 0;
  const outOfStock = stock <= 0;
  const atMaxInCart = !outOfStock && cartQty >= stock;
  const addToCartDisabled = outOfStock || atMaxInCart;

  return (
    <button
      onClick={() => addToCart(product)}
      disabled={addToCartDisabled}
      className={`w-full text-xs uppercase tracking-wider px-5 py-3.5 rounded font-medium transition duration-200 shadow-sm ${
        addToCartDisabled
          ? "bg-stone-200 text-stone-400 cursor-not-allowed"
          : "bg-stone-900 hover:bg-amber-700 text-white active:scale-95"
      }`}
    >
      {outOfStock ? "Out of Stock" : atMaxInCart ? "Max Stock in Cart" : "Add To Cart"}
    </button>
  );
}
