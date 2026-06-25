"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { uploadCatalogImage } from "@/lib/admin/actions";

type ImageUploadFieldProps = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
};

export default function ImageUploadField({
  label = "Image",
  value,
  onChange,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadCatalogImage(formData);
      if (result.error || !result.url) {
        setError(result.error ?? "Upload failed");
        return;
      }
      onChange(result.url);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/products/example.png or upload"
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span className="ml-2">{uploading ? "Uploading…" : "Upload to Storage"}</span>
        </Button>

        {value && (
          <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-700 bg-gray-800">
            <Image src={value} alt="" fill className="object-contain p-1" unoptimized />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
