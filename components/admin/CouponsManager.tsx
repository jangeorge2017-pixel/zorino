"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { adminDeleteCoupon, adminSaveCoupon } from "@/lib/admin/actions";
import type { Coupon, Store } from "@/lib/types/entities";

const emptyForm = {
  id: "",
  storeId: "",
  code: "",
  title: "",
  offer: "",
  minSpend: "",
  discount: "",
  discountType: "percentage",
  usedTimes: "0",
  verified: true,
  isActive: true,
};

type CouponsManagerProps = {
  initialCoupons: Coupon[];
  stores: Store[];
};

export default function CouponsManager({ initialCoupons, stores }: CouponsManagerProps) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const storeOptions = stores.map((s) => ({ value: s.id, label: s.name }));

  const openCreate = () => {
    setForm({ ...emptyForm, storeId: stores[0]?.id ?? "" });
    setError("");
    setOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setForm({
      id: coupon.id,
      storeId: coupon.storeId,
      code: coupon.code,
      title: coupon.title,
      offer: coupon.offer,
      minSpend: coupon.minSpend ?? "",
      discount: coupon.discount.toString(),
      discountType: coupon.discountType,
      usedTimes: coupon.usedTimes.toString(),
      verified: coupon.verified,
      isActive: coupon.isActive,
    });
    setError("");
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const result = await adminSaveCoupon({
      id: form.id || undefined,
      storeId: form.storeId,
      code: form.code,
      title: form.title,
      offer: form.offer,
      minSpend: form.minSpend,
      discount: Number(form.discount),
      discountType: form.discountType as "percentage" | "fixed",
      usedTimes: Number(form.usedTimes) || 0,
      verified: form.verified,
      isActive: form.isActive,
    });
    setSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Save failed");
      return;
    }
    setCoupons((prev) => {
      const saved = { ...result.data!, store: stores.find((s) => s.id === result.data!.storeId) };
      const exists = prev.some((c) => c.id === saved.id);
      return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev];
    });
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    const result = await adminDeleteCoupon(id);
    if (result.error) {
      alert(result.error);
      return;
    }
    setCoupons((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <>
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Coupons</h1>
            <p className="text-gray-400 text-sm">{coupons.length} active codes</p>
          </div>
          <Button onClick={openCreate} disabled={stores.length === 0}>
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Coupon
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-3 pr-4">Code</th>
                <th className="py-3 pr-4">Store</th>
                <th className="py-3 pr-4">Offer</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-gray-800/60">
                  <td className="py-3 pr-4 font-mono text-purple-300">{coupon.code}</td>
                  <td className="py-3 pr-4 text-gray-300">{coupon.store?.name ?? "—"}</td>
                  <td className="py-3 pr-4 text-white">{coupon.offer}</td>
                  <td className="py-3 pr-4">
                    <span className={coupon.isActive ? "text-green-400" : "text-gray-500"}>
                      {coupon.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(coupon)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(coupon.id)}>
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

      <Modal isOpen={open} onClose={() => setOpen(false)} title={form.id ? "Edit Coupon" : "Add Coupon"} className="max-w-xl">
        <div className="space-y-4">
          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-400 text-sm">{error}</div>}
          <Select label="Store" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} options={storeOptions} />
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Offer" value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} />
          <Input label="Min spend" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Discount" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            <Select
              label="Type"
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value })}
              options={[
                { value: "percentage", label: "Percentage" },
                { value: "fixed", label: "Fixed" },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} />
              Verified
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.storeId || !form.code || !form.title}>
              {saving ? "Saving…" : "Save Coupon"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
