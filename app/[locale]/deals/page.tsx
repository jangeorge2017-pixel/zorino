'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { Clock, TrendingUp, Star, ExternalLink } from 'lucide-react';

export default function DealsPage() {
  const t = useTranslations('deals');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [sortBy, setSortBy] = useState('relevance');

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'home', label: 'Home & Garden' },
    { value: 'sports', label: 'Sports' },
    { value: 'toys', label: 'Toys' },
  ];

  const stores = [
    { value: '', label: 'All Stores' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'alibaba', label: 'Alibaba' },
    { value: 'aliexpress', label: 'AliExpress' },
    { value: 'noon', label: 'Noon' },
    { value: 'temu', label: 'Temu' },
  ];

  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'discount', label: 'Highest Discount' },
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' },
    { value: 'ending_soon', label: 'Ending Soon' },
  ];

  const mockDeals = [
    {
      id: 1,
      title: 'iPhone 15 Pro Max 256GB',
      image: '📱',
      originalPrice: 1199,
      dealPrice: 999,
      discount: 17,
      store: 'Amazon',
      rating: 4.8,
      reviewCount: 1250,
      endsIn: '2 days',
      featured: true,
    },
    {
      id: 2,
      title: 'MacBook Air M3 13"',
      image: '💻',
      originalPrice: 1299,
      dealPrice: 1099,
      discount: 15,
      store: 'Apple',
      rating: 4.9,
      reviewCount: 890,
      endsIn: '5 days',
      featured: true,
    },
    {
      id: 3,
      title: 'Sony WH-1000XM5 Headphones',
      image: '🎧',
      originalPrice: 399,
      dealPrice: 299,
      discount: 25,
      store: 'Amazon',
      rating: 4.7,
      reviewCount: 2340,
      endsIn: '1 day',
      featured: false,
    },
    {
      id: 4,
      title: 'Samsung 65" QLED 4K TV',
      image: '📺',
      originalPrice: 899,
      dealPrice: 699,
      discount: 22,
      store: 'Best Buy',
      rating: 4.6,
      reviewCount: 567,
      endsIn: '3 days',
      featured: false,
    },
    {
      id: 5,
      title: 'Nike Air Jordan 1',
      image: '👟',
      originalPrice: 180,
      dealPrice: 140,
      discount: 22,
      store: 'Nike',
      rating: 4.8,
      reviewCount: 3420,
      endsIn: '4 days',
      featured: true,
    },
    {
      id: 6,
      title: 'PlayStation 5 Console',
      image: '🎮',
      originalPrice: 499,
      dealPrice: 449,
      discount: 10,
      store: 'Amazon',
      rating: 4.9,
      reviewCount: 8900,
      endsIn: '1 week',
      featured: true,
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label={t('filterByCategory')}
              options={categories}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            />
            <Select
              label={t('filterByStore')}
              options={stores}
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            />
            <Select
              label={t('sortBy')}
              options={sortOptions}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            />
            <div className="flex items-end">
              <Button className="w-full">{t('filter')}</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockDeals.map((deal) => (
            <Card key={deal.id} hover className="overflow-hidden">
              {deal.featured && (
                <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white text-xs font-bold px-3 py-1 inline-block">
                  {t('featured')}
                </div>
              )}
              
              <div className="text-6xl text-center py-8">{deal.image}</div>
              
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white line-clamp-2">
                  {deal.title}
                </h3>
                
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span>{deal.rating}</span>
                  <span>({deal.reviewCount} {t('reviews')})</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">${deal.dealPrice}</span>
                  <span className="text-gray-500 line-through">${deal.originalPrice}</span>
                  <span className="bg-green-500/20 text-green-400 text-sm font-bold px-2 py-1 rounded">
                    -{deal.discount}%
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>{t('dealEndsIn')} {deal.endsIn}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>{deal.store}</span>
                  <ExternalLink className="w-4 h-4" />
                </div>
                
                <Button className="w-full">{t('viewDetails')}</Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline">{t('viewAllDeals')}</Button>
        </div>
      </div>
    </div>
  );
}
