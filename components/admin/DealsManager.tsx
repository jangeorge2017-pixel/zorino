"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { adminDeleteDeal, adminSaveDeal } from "@/lib/admin/actions";
import type { Deal, Product, Store } from "@/lib/types/entities";

const emptyForm = {
  id: "",
  productId: "",
  storeId: "",
  title: "",
  discount: "",
  price: "",
  originalPrice: "",
  isFeatured: false,
  isActive: true,
  sortOrder: "0",
};

type DealsManagerProps = {
  initialDeals: Deal[];
  products: Product[];
  stores: Store[];
};

export default function DealsManager({ initialDeals, products, stores }: DealsManagerProps) {
  const [deals, setDeals] = useState(initialDeals);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const productOptions = [
    { value: "", label: "None" },
    ...products.map((p) => ({ value: p.id, label: p.name })),
  ];
  const storeOptions = [
    { value: "", label: "None" },
    ...stores.map((s) => ({ value: s.id, label: s.name })),
  ];

  const openCreate = () => {
    setForm(emptyForm);
    setError("");
    setOpen(true);
  };

  const openEdit = (deal: Deal) => {
    setForm({
      id: deal.id,
      productId: deal.productId ?? "",
      storeId: deal.storeId ?? "",
      title: deal.title,
      discount: deal.discount.toString(),
      price: deal.price.toString(),
      originalPrice: deal.originalPrice.toString(),
      isFeatured: deal.isFeatured,
      isActive: deal.isActive,
      sortOrder: deal.sortOrder.toString(),
    });
    setError("");
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const result = await adminSaveDeal({
      id: form.id || undefined,
      productId: form.productId || undefined,
      storeId: form.storeId || undefined,
      title: form.title,
      discount: Number(form.discount),
      price: Number(form.price),
      originalPrice: Number(form.originalPrice),
      isFeatured: form.isFeatured,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    });
    setSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Save failed");
      return;
    }
    setDeals((prev) => {
      const saved = {
        ...result.data!,
        product: products.find((p) => p.id === result.data!.productId),
        store: stores.find((s) => s.id === result.data!.storeId),
      };
      const exists = prev.some((d) => d.id === saved.id);
      return exists ? prev.map((d) => (d.id === saved.id ? saved : d)) : [saved, ...prev];
    });
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this deal?")) return;
    const result = await adminDeleteDeal(id);
    if (result.error) {
      alert(result.error);
      return;
    }
    setDeals((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <>
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Deals</h1>
            <p className="text-gray-400 text-sm">{deals.length} deal listings</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Deal
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-3 pr-4">Title</th>
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4">Price</th>
                <th className="py-3 pr-4">Featured</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} className="border-b border-gray-800/60">
                  <td className="py-3 pr-4 text-white font-medium">{deal.title}</td>
                  <td className="py-3 pr-4 text-gray-300">{deal.product?.name ?? "—"}</td>
                  <td className="py-3 pr-4 text-gray-300">${deal.price}</td>
                  <td className="py-3 pr-4">{deal.isFeatured ? "Yes" : "No"}</td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(deal)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(deal.id)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={form.id ? "Edit Deal" : "Add Deal"} className="max-w-xl">
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-400 text-sm">{error}</div>}
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Select label="Product" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} options={productOptions} />
          <Select label="Store" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} options={storeOptions} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Discount %" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            <Input label="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input label="Original" type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
          </div>
          <Input label="Sort order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
              Featured on homepage
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.price}>
              {saving ? "Saving…" : "Save Deal"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
