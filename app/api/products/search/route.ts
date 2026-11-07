import { NextResponse } from 'next/server';

function detectAndTranslate(text: string): string {
  const lower = text.toLowerCase().trim();
  if (lower.startsWith('ayf') || lower.startsWith('ايف') || lower.includes('iphone')) {
    return 'iphone';
  }
  if (lower.startsWith('sa') || lower.startsWith('ساع') || lower.includes('watch')) {
    return 'watch';
  }
  return lower;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const englishQuery = detectAndTranslate(query);

    const mockCatalog = [
      { id: '1', title: 'iPhone 15 Pro Max', price: '1200', image_url: 'https://unsplash.com', store: 'Amazon Eg' },
      { id: '2', title: 'iPhone 14 Plus', price: '900', image_url: 'https://unsplash.com', store: 'Noon' },
      { id: '3', title: 'Apple Watch Series 9', price: '450', image_url: 'https://unsplash.com', store: 'Jumia' },
      { id: '4', title: 'Smart Watch Ultra', price: '299', image_url: 'https://unsplash.com', store: 'Amazon Eg' }
    ];

    const filtered = mockCatalog.filter(p => p.title.toLowerCase().includes(englishQuery));

    return NextResponse.json({ 
      products: filtered.length > 0 ? filtered : mockCatalog, 
      status: 'success' 
    });

  } catch (error) {
    return NextResponse.json({ products: [], status: 'error' });
  }
}