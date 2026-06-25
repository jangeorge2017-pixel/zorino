"use client";
import React from "react";
import Navbar from "@/components/navbar";

export default function CartPage() {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-4">Your Cart</h1>
        <div className="p-10 border border-dashed border-white/10 rounded-3xl text-center text-gray-500">
          Your cart is empty.
        </div>
      </div>
    </main>
  );
}
