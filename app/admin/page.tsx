// app/admin/page.tsx
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize client browser connection architecture using your unique network parameters
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yfpUfp0RTaHs6nL3VEcnZQ_H_u-KA7C";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    imageUrl: "",
    inventory: "5"
  });
  
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Load both inventory data and logged customer order transactions from Supabase on mount
  const fetchData = async () => {
    // 1. Fetch Products
    const { data: productData, error: productErr } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (!productErr && productData) setProducts(productData);

    // 2. Fetch Orders
    setLoadingOrders(true);
    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (!orderErr && orderData) setOrders(orderData);
    setLoadingOrders(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Form Submission (Handles BOTH Creating and Updating products)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(editingProductId ? "Updating brass item records..." : "Publishing item to Supabase storage...");
    setIsSubmitting(true);

    try {
      if (editingProductId) {
        // ACTION A: Update Existing Product Data Row
        const { error } = await supabase
          .from("products")
          .update({
            name: formData.name,
            price: parseFloat(formData.price),
            description: formData.description,
            image_url: formData.imageUrl,
            inventory: parseInt(formData.inventory),
          })
          .eq("id", editingProductId);

        if (error) throw error;
        setStatus("Success! Your modifications have been updated live across the storefront.");
        setEditingProductId(null);
      } else {
        // ACTION B: Create Brand New Row Entry
        const { error } = await supabase
          .from("products")
          .insert([
            {
              name: formData.name,
              price: parseFloat(formData.price),
              description: formData.description,
              image_url: formData.imageUrl,
              inventory: parseInt(formData.inventory),
            }
          ]);

        if (error) throw error;
        setStatus("Success! The premium brass product is live on your storefront catalog.");
      }

      setFormData({ name: "", price: "", description: "", imageUrl: "", inventory: "5" });
      fetchData(); // Sync live view structures
    } catch (err: any) {
      setStatus(`Database Exception: ${err.message || "Pipeline connection failed."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pull product parameters back up into inputs to edit fields
  const handleEditClick = (product: any) => {
    setEditingProductId(product.id);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      description: product.description,
      imageUrl: product.image_url,
      inventory: product.inventory.toString()
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Fast inline adjust function for stock adjustments (+ / - keys)
  const handleStockUpdate = async (productId: string, currentStock: number, adjustment: number) => {
    const newStock = Math.max(0, currentStock + adjustment);
    const { error } = await supabase
      .from("products")
      .update({ inventory: newStock })
      .eq("id", productId);

    if (error) {
      alert(`Could not change stock: ${error.message}`);
    } else {
      setProducts(products.map(p => p.id === productId ? { ...p, inventory: newStock } : p));
      if (editingProductId === productId) {
        setFormData(prev => ({ ...prev, inventory: newStock.toString() }));
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setFormData({ name: "", price: "", description: "", imageUrl: "", inventory: "5" });
    setStatus("");
  };

  const handleLogout = () => {
    window.location.href = "https://log:out@localhost:3000/";
  };

  return (
    <div className="bg-[#FAF9F6] min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-6 space-y-12">
        
        {/* HEADER BRAND WORKSPACE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-6">
          <div>
            <h1 className="text-3xl font-serif text-stone-900 tracking-wide">Tohfa Admin Workspace</h1>
            <p className="text-stone-500 text-xs mt-1">Central management command layer for items, inventory balances, and client orders.</p>
          </div>
          <button type="button" onClick={handleLogout} className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border border-stone-300 rounded text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition">
            Exit Workspace
          </button>
        </div>

        {/* SECTION A: PRODUCT REGISTRY MANAGEMENT FORM */}
        <div className={`bg-white border rounded-lg shadow-sm p-8 transition duration-300 ${editingProductId ? "border-amber-500 shadow-amber-50" : "border-amber-200"}`}>
          <div className="border-b border-stone-100 pb-4 mb-6 flex items-center justify-between">
            <h2 className="text-xl font-serif text-stone-900">
              {editingProductId ? "Modify Active Artifact Details" : "Publish New Brass Artifact"}
            </h2>
            {editingProductId && (
              <button type="button" onClick={handleCancelEdit} className="px-3 py-1 text-xs uppercase tracking-wider font-semibold border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded transition">
                Cancel Edit Mode
              </button>
            )}
          </div>

          {status && (
            <div className={`mb-6 p-4 text-xs font-medium rounded border ${status.startsWith("Success") ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
              {status}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Artifact Title</label>
                <input type="text" required disabled={isSubmitting} placeholder="e.g., Premium Brass Engraved Peacock Diya" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Price (INR ₹)</label>
                <input type="number" required disabled={isSubmitting} placeholder="e.g., 3500" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Public Image Link</label>
              <input type="url" required disabled={isSubmitting} placeholder="https://gxlervcazzddqcoagewy.supabase.co/storage/v1/object/public/..." value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Craftsmanship Description</label>
                <textarea rows={4} required disabled={isSubmitting} placeholder="Detail structural weight parameters, hand carvings, and antique finish attributes..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Initial Stock Allocation</label>
                <input type="number" required disabled={isSubmitting} value={formData.inventory} onChange={(e) => setFormData({...formData, inventory: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-stone-100">
              <button type="submit" disabled={isSubmitting} className={`font-medium text-xs uppercase tracking-widest px-8 py-3.5 rounded shadow text-white transition duration-150 ${editingProductId ? "bg-amber-600 hover:bg-amber-700" : "bg-stone-950 hover:bg-amber-800"}`}>
                {isSubmitting ? "Processing..." : editingProductId ? "Update Brass Artifact" : "Publish Brass Artifact"}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION B: ACTIVE PRODUCT INVENTORY BALANCES TUNER */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6">
            <h2 className="text-xl font-serif text-stone-900">Live Storefront Catalog & Stock Tracker</h2>
            <p className="text-stone-500 text-xs mt-1">Manage physical stock variations or open a product's text fields to overwrite details cleanly.</p>
          </div>

          {products.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No products found in cloud database storage.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {products.map((product) => (
                <div key={product.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-grow">
                    <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded object-cover border border-stone-200 bg-stone-50 flex-shrink-0" />
                    <div>
                      <h3 className="font-serif text-stone-900 text-sm font-medium">{product.name}</h3>
                      <p className="text-amber-800 text-xs font-mono font-bold">₹{Number(product.price).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-0 pt-3 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleStockUpdate(product.id, product.inventory, -1)} className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 transition">-</button>
                      <div className="w-12 text-center">
                        <span className={`text-sm font-mono font-bold px-2.5 py-1 rounded ${product.inventory === 0 ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-800"}`}>
                          {product.inventory}
                        </span>
                      </div>
                      <button onClick={() => handleStockUpdate(product.id, product.inventory, 1)} className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 transition">+</button>
                    </div>
                    
                    <button type="button" onClick={() => handleEditClick(product)} className="px-4 py-2 border border-amber-600 rounded text-amber-700 hover:bg-amber-50 font-semibold text-xs uppercase shadow-sm transition">
                      Edit Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION C: SECURE INCOMING CUSTOMER ORDERS LEDGER */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6">
            <h2 className="text-xl font-serif text-stone-900">Settled Customer Transactions</h2>
            <p className="text-stone-500 text-xs mt-1">Real-time purchase streams verified and pushed directly by your Razorpay webhook endpoint script.</p>
          </div>

          {loadingOrders ? (
            <p className="text-stone-400 text-sm text-center py-6 animate-pulse">Syncing transactions ledger from cloud data cache...</p>
          ) : orders.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No payment captured records generated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs sm:text-sm text-stone-600 border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[11px] tracking-wider border-b border-stone-200">
                    <th className="p-4">Payment Reference ID</th>
                    <th className="p-4">Customer Info</th>
                    <th className="p-4">Purchased Items</th>
                    <th className="p-4 text-right">Revenue Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-stone-50/50 transition">
                      <td className="p-4 font-mono font-bold text-stone-800">
                        {order.payment_id}
                        <span className="block text-[10px] text-stone-400 font-normal mt-1">
                          {new Date(order.created_at).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="p-4 font-light">
                        <div className="font-normal text-stone-900">{order.customer_details?.name || "Pushkal Singh"}</div>
                        <div className="text-xs text-stone-500 mt-0.5">{order.customer_details?.email}</div>
                        <div className="text-xs text-stone-400 mt-0.5">{order.customer_details?.contact}</div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {Array.isArray(order.items) ? (
                            order.items.map((item: any, idx: number) => (
                              <div key={idx} className="text-xs text-stone-700 font-light">
                                • <span className="font-normal text-stone-900">{item.name}</span> 
                                <span className="text-amber-800 font-medium ml-1">x{item.quantity}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-stone-400 text-xs">Standard checkout package</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-amber-800 text-base">
                        ₹{Number(order.amount).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}