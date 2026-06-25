"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { adminDeleteStore, adminSaveStore } from "@/lib/admin/actions";
import type { Store } from "@/lib/types/entities";

const integrationOptions = [
  { value: "custom", label: "Custom" },
  { value: "amazon", label: "Amazon" },
  { value: "aliexpress", label: "AliExpress" },
  { value: "shopify", label: "Shopify" },
  { value: "noon", label: "Noon" },
  { value: "walmart", label: "Walmart" },
  { value: "partner", label: "Partner" },
];

const emptyForm = {
  id: "",
  name: "",
  slug: "",
  logoUrl: "",
  logoInitial: "",
  website: "",
  integrationType: "custom",
  isActive: true,
};

type StoresManagerProps = {
  initialStores: Store[];
};

export default function StoresManager({ initialStores }: StoresManagerProps) {
  const [stores, setStores] = useState(initialStores);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setError("");
    setOpen(true);
  };

  const openEdit = (store: Store) => {
    setForm({
      id: store.id,
      name: store.name,
      slug: store.slug,
      logoUrl: store.logoUrl ?? "",
      logoInitial: store.logoInitial ?? "",
      website: store.website,
      integrationType: store.integrationType,
      isActive: store.isActive,
    });
    setError("");
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const result = await adminSaveStore({
      id: form.id || undefined,
      name: form.name,
      slug: form.slug || undefined,
      logoUrl: form.logoUrl,
      logoInitial: form.logoInitial,
      website: form.website,
      integrationType: form.integrationType as Store["integrationType"],
      isActive: form.isActive,
    });
    setSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Save failed");
      return;
    }
    setStores((prev) => {
      const exists = prev.some((s) => s.id === result.data!.id);
      return exists
        ? prev.map((s) => (s.id === result.data!.id ? result.data! : s))
        : [result.data!, ...prev];
    });
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this store?")) return;
    const result = await adminDeleteStore(id);
    if (result.error) {
      alert(result.error);
      return;
    }
    setStores((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <>
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Stores</h1>
            <p className="text-gray-400 text-sm">{stores.length} marketplace partners</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Store
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-3 pr-4">Store</th>
                <th className="py-3 pr-4">Integration</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="border-b border-gray-800/60">
                  <td className="py-3 pr-4">
                    <p className="text-white font-medium">{store.name}</p>
                    <p className="text-gray-500 text-xs">{store.website}</p>
                  </td>
                  <td className="py-3 pr-4 text-gray-300 capitalize">{store.integrationType}</td>
                  <td className="py-3 pr-4">
                    <span className={store.isActive ? "text-green-400" : "text-gray-500"}>
                      {store.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(store)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(store.id)}>
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
        title={form.id ? "Edit Store" : "Add Store"}
        className="max-w-xl"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <Input label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <ImageUploadField label="Logo URL" value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Logo Initial" value={form.logoInitial} onChange={(e) => setForm({ ...form, logoInitial: e.target.value })} />
            <Select
              label="Integration"
              value={form.integrationType}
              onChange={(e) => setForm({ ...form, integrationType: e.target.value })}
              options={integrationOptions}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.website}>
              {saving ? "Saving…" : "Save Store"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
