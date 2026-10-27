import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/services/products";
import NodeCache from "node-cache";

const searchCache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 600,
  useClones: false,
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || url.searchParams.get("query") || "";
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");
    const importedOnlyParam = url.searchParams.get("importedOnly");

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const importedOnly = importedOnlyParam === "false" ? false : true;

    const cacheKey = `search:${query.toLowerCase().trim()}:page:${Number.isNaN(page) ? 1 : page}:limit:${Number.isNaN(limit) ? 20 : limit}:importedOnly:${importedOnly}`;

    const cachedData = searchCache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const result = await searchProducts(query, {
      page: Number.isNaN(page) ? 1 : page,
      limit: Number.isNaN(limit) ? 20 : limit,
      importedOnly,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    searchCache.set(cacheKey, result.data);
    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Products search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
