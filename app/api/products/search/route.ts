import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const mockCatalog = [
    { id: '1', title: 'iPhone 15 Pro Max', price: '1200', image_url: 'https://placeholder.com', store: 'Amazon Eg' },
    { id: '2', title: 'iPhone 14 Plus', price: '900', image_url: 'https://placeholder.com', store: 'Noon' },
    { id: '3', title: 'Apple Watch Series 9', price: '450', image_url: 'https://placeholder.com', store: 'Jumia' },
    { id: '4', title: 'Smart Watch Ultra', price: '299', image_url: 'https://placeholder.com', store: 'Amazon Eg' }
  ];

  return NextResponse.json({ 
    products: mockCatalog, 
    status: 'success' 
  });
}