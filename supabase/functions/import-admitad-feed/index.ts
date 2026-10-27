// supabase/functions/import-admitad-feed/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

interface AdmitadProduct {
  id?: string | number;
  product_id?: string | number;
  offer_id?: string | number;
  name?: string;
  title?: string;
  product_name?: string;
  description?: string;
  price?: string | number;
  old_price?: string | number;
  original_price?: string | number;
  retail_price?: string | number;
  currency?: string;
  image_url?: string;
  image?: string;
  picture?: string;
  url?: string;
  product_url?: string;
  deeplink?: string;
  affiliate_url?: string;
  category_id?: string | number;
  category_name?: string;
  brand?: string;
  merchant_name?: string;
  shop_name?: string;
  in_stock?: string | boolean;
  availability?: string;
}

interface ProductRow {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  image_url: string;
  category_id?: string | null;
  category_slug?: string | null;
  brand?: string | null;
  price?: number | null;
  original_price?: number | null;
  currency: string;
  country_code?: string | null;
  in_stock: boolean;
  external_url?: string | null;
  affiliate_url?: string | null;
  external_product_id?: string | null;
  is_active?: boolean;
  updated_at?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseCSV(csvText: string): AdmitadProduct[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, '').trim());
  const products: AdmitadProduct[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const product: AdmitadProduct = {};
    
    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        product[header as keyof AdmitadProduct] = values[index].replace(/"/g, '').trim();
      }
    });
    
    products.push(product);
  }
  
  return products;
}

function mapToProductRow(product: AdmitadProduct): ProductRow | null {
  const productId = product.id || product.product_id || product.offer_id;
  if (!productId) return null;
  
  const name = product.name || product.title || product.product_name;
  if (!name) return null;
  
  const imageUrl = product.image_url || product.image || product.picture;
  if (!imageUrl) return null;
  
  const price = parseFloat(String(product.price || '0'));
  if (isNaN(price) || price <= 0) return null;
  
  const originalPrice = parseFloat(String(product.old_price || product.original_price || product.retail_price || '0'));
  const currency = product.currency || 'USD';
  
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
  
  const inStock = product.in_stock === true || 
                  product.in_stock === 'true' || 
                  product.in_stock === '1' ||
                  product.availability?.toLowerCase() === 'in stock' ||
                  product.availability === 'true';
  
  return {
    id: String(productId),
    name: name.substring(0, 500),
    slug: slug || null,
    description: product.description?.substring(0, 2000) || null,
    image_url: imageUrl,
    category_slug: product.category_name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
    brand: product.brand || product.merchant_name || product.shop_name || null,
    price: price,
    original_price: isNaN(originalPrice) || originalPrice <= 0 ? null : originalPrice,
    currency: currency,
    in_stock: inStock,
    external_url: product.url || product.product_url || null,
    affiliate_url: product.deeplink || product.affiliate_url || product.url || product.product_url || null,
    external_product_id: String(productId),
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

async function processBatch(
  products: ProductRow[],
  supabase: any,
  batchSize: number
): Promise<number> {
  let processed = 0;
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    try {
      const { error } = await supabase
        .from('products')
        .upsert(batch, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`Batch upsert error at ${i}:`, error.message);
        continue;
      }
      
      processed += batch.length;
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}, total: ${processed}`);
    } catch (err) {
      console.error(`Batch processing error at ${i}:`, err);
    }
  }
  
  return processed;
}

serve(async (req: Request) => {
  try {
    const ADMITAD_CSV_URL = Deno.env.get('ADMITAD_CSV_URL');
    
    if (!ADMITAD_CSV_URL) {
      return new Response(
        JSON.stringify({ error: 'ADMITAD_CSV_URL not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('Fetching CSV from:', ADMITAD_CSV_URL);
    
    const response = await fetch(ADMITAD_CSV_URL, {
      headers: {
        'User-Agent': 'Zorino-Import/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log(`CSV fetched, size: ${csvText.length} bytes`);
    
    const parsedProducts = parseCSV(csvText);
    console.log(`Parsed ${parsedProducts.length} products from CSV`);
    
    const productRows: ProductRow[] = [];
    for (const product of parsedProducts) {
      const row = mapToProductRow(product);
      if (row) {
        productRows.push(row);
      }
    }
    
    console.log(`Mapped ${productRows.length} valid products for upsert`);
    
    const batchSize = 500;
    const processed = await processBatch(productRows, supabase, batchSize);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Import completed',
        total_parsed: parsedProducts.length,
        valid_mapped: productRows.length,
        processed,
        batch_size: batchSize
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
