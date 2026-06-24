"use client";
import React from "react";
// استدعاء المكونات التي قمنا بإصلاحها فقط
import Navbar from "@/components/navbar";
import Hero from "@/components/Hero";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6">
        <Hero />
        
        {/* هذا الجزء مؤقت حتى لا يظهر خطأ في المشروع */}
        <div className="mt-20 p-10 border border-dashed border-white/10 rounded-3xl text-center text-gray-500">
          Main content area is safe now. 
          Ready to add Product Cards...
        </div>
      </div>
    </main>
  );
}
