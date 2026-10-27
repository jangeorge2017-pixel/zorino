import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/services/products";
import NodeCache from "node-cache";
import translate from "google-translate-api-x";

const searchCache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 600,
  useClones: false,
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let q = url.searchParams.get("q") || url.searchParams.get("query") || "";
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");
    const importedOnlyParam = url.searchParams.get("importedOnly");

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const importedOnly = importedOnlyParam === "false" ? false : true;

    const isArabic = /[\u0600-\u06FF]/.test(q);
    let searchQuery = q;

    if (isArabic && q.trim()) {
      try {
        const translated = await translate(q, { to: "en" });
        if (translated?.text) {
          searchQuery = translated.text;
        }
      } catch (error) {
        console.error("Translation error:", error);
        searchQuery = q;
      }
    }

    const cacheKey = `search:${searchQuery.toLowerCase().trim()}:page:${Number.isNaN(page) ? 1 : page}:limit:${Number.isNaN(limit) ? 20 : limit}:importedOnly:${importedOnly}:ar:${isArabic}`;

    const cachedData = searchCache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    let result;
    result = await searchProducts(searchQuery, {
      page: Number.isNaN(page) ? 1 : page,
      limit: Number.isNaN(limit) ? 20 : limit,
      importedOnly,
    });

    const hasData = Array.isArray((result as any)?.data)
      ? ((result as any).data.length > 0)
      : Array.isArray((result as any)?.data?.data)
        ? ((result as any).data.data.length > 0)
        : false;

    if (!hasData && searchQuery !== q) {
      result = await searchProducts(q, {
        page: Number.isNaN(page) ? 1 : page,
        limit: Number.isNaN(limit) ? 20 : limit,
        importedOnly,
        forceIlike: true,
      });
    } else if (!hasData && !isArabic) {
      result = await searchProducts(searchQuery, {
        page: Number.isNaN(page) ? 1 : page,
        limit: Number.isNaN(limit) ? 20 : limit,
        importedOnly,
        forceIlike: true,
      });
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    const dataToCache = (result as any).data;
    const hasDataToCache = Array.isArray(dataToCache)
      ? dataToCache.length > 0
      : Array.isArray(dataToCache?.data)
        ? dataToCache.data.length > 0
        : false;

    if (hasDataToCache) {
      searchCache.set(cacheKey, dataToCache);
    }

    return NextResponse.json(dataToCache);
  } catch (error) {
    console.error("Products search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
