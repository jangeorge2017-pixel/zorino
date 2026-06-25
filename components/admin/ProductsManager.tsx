"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import ImageUploadField from "@/components/admin/ImageUploadField";
import {
  adminDeleteProduct,
  adminSaveProduct,
} from "@/lib/admin/actions";
import type { Product } from "@/lib/types/entities";

type ProductsManagerProps = {
  initialProducts: Product[];
  categories: { slug: string; name: string }[];
};

const emptyForm = {
  id: "",
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  emoji: "",
  categorySlug: "",
  brand: "",
  rating: "",
  reviewCount: "0",
  currency: "USD",
  inStock: true,
  isActive: true,
};

export default function ProductsManager({ initialProducts, categories }: ProductsManagerProps) {
  const [products, setProducts] = useState(initialProducts);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setError("");
    setOpen(true);
  };

  const openEdit = (product: Product) => {
    setForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      imageUrl: product.imageUrl,
      emoji: product.emoji ?? "",
      categorySlug: product.categorySlug ?? "",
      brand: product.brand ?? "",
      rating: product.rating?.toString() ?? "",
      reviewCount: product.reviewCount.toString(),
      currency: product.currency,
      inStock: product.inStock,
      isActive: product.isActive,
    });
    setError("");
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const result = await adminSaveProduct({
      id: form.id || undefined,
      name: form.name,
      slug: form.slug || undefined,
      description: form.description,
      imageUrl: form.imageUrl,
      emoji: form.emoji,
      categorySlug: form.categorySlug || undefined,
      brand: form.brand,
      rating: form.rating ? Number(form.rating) : undefined,
      reviewCount: Number(form.reviewCount) || 0,
      currency: form.currency,
      inStock: form.inStock,
      isActive: form.isActive,
    });

    setSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Save failed");
      return;
    }

    setProducts((prev) => {
      const exists = prev.some((p) => p.id === result.data!.id);
      return exists
        ? prev.map((p) => (p.id === result.data!.id ? result.data! : p))
        : [result.data!, ...prev];
    });
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const result = await adminDeleteProduct(id);
    if (result.error) {
      alert(result.error);
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <>
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Products</h1>
            <p className="text-gray-400 text-sm">{products.length} items in catalog</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Product
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Category</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-gray-800/60">
                  <td className="py-3 pr-4">
                    <p className="text-white font-medium">{product.name}</p>
                    <p className="text-gray-500 text-xs">{product.slug}</p>
                  </td>
                  <td className="py-3 pr-4 text-gray-300">{product.categorySlug ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className={product.isActive ? "text-green-400" : "text-gray-500"}>
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
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

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Edit Product" : "Add Product"}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="auto-generated from name"
          />
          <ImageUploadField
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              value={form.categorySlug}
              onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
              options={[
                { value: "", label: "None" },
                ...categories.map((c) => ({ value: c.slug, label: c.name })),
              ]}
            />
            <Input
              label="Brand"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </div>
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input
              label="Emoji"
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            />
            <Input
              label="Rating"
              type="number"
              step="0.1"
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: e.target.value })}
            />
            <Input
              label="Reviews"
              type="number"
              value={form.reviewCount}
              onChange={(e) => setForm({ ...form, reviewCount: e.target.value })}
            />
            <Input
              label="Currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.inStock}
                onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
              />
              In stock
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.imageUrl}>
              {saving ? "Saving…" : "Save Product"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
