'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { Star, ExternalLink, TrendingUp, Globe, CheckCircle } from 'lucide-react';

export default function StoresPage() {
  const t = useTranslations('stores');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('rating');

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'home', label: 'Home & Garden' },
    { value: 'sports', label: 'Sports' },
  ];

  const sortOptions = [
    { value: 'rating', label: 'Highest Rating' },
    { value: 'products', label: 'Most Products' },
    { value: 'reviews', label: 'Most Reviews' },
    { value: 'name', label: 'Name A-Z' },
  ];

  const stores = [
    {
      id: 1,
      name: 'Amazon',
      nameAr: 'أمازون',
      slug: 'amazon',
      logo: '🛒',
      website: 'https://amazon.com',
      rating: 4.8,
      reviewCount: 125000,
      country: 'Global',
      productCount: 500000,
      integrationType: 'amazon' as const,
      affiliateCommission: 4,
      featured: true,
      verified: true,
    },
    {
      id: 2,
      name: 'Alibaba',
      nameAr: 'علي بابا',
      slug: 'alibaba',
      logo: '🏭',
      website: 'https://alibaba.com',
      rating: 4.6,
      reviewCount: 89000,
      country: 'China',
      productCount: 300000,
      integrationType: 'alibaba' as const,
      affiliateCommission: 3,
      featured: true,
      verified: true,
    },
    {
      id: 3,
      name: 'AliExpress',
      nameAr: 'إكسبريس علي',
      slug: 'aliexpress',
      logo: '📦',
      website: 'https://aliexpress.com',
      rating: 4.5,
      reviewCount: 76000,
      country: 'China',
      productCount: 250000,
      integrationType: 'aliexpress' as const,
      affiliateCommission: 5,
      featured: true,
      verified: true,
    },
    {
      id: 4,
      name: 'Noon',
      nameAr: 'نون',
      slug: 'noon',
      logo: '🌙',
      website: 'https://noon.com',
      rating: 4.4,
      reviewCount: 34000,
      country: 'UAE',
      productCount: 150000,
      integrationType: 'noon' as const,
      affiliateCommission: 6,
      featured: false,
      verified: true,
    },
    {
      id: 5,
      name: 'Temu',
      nameAr: 'تيمو',
      slug: 'temu',
      logo: '🎯',
      website: 'https://temu.com',
      rating: 4.3,
      reviewCount: 28000,
      country: 'China',
      productCount: 180000,
      integrationType: 'temu' as const,
      affiliateCommission: 7,
      featured: false,
      verified: true,
    },
    {
      id: 6,
      name: 'eBay',
      nameAr: 'إيباي',
      slug: 'ebay',
      logo: '🏷️',
      website: 'https://ebay.com',
      rating: 4.5,
      reviewCount: 95000,
      country: 'Global',
      productCount: 400000,
      integrationType: 'custom' as const,
      affiliateCommission: 4,
      featured: false,
      verified: true,
    },
    {
      id: 7,
      name: 'Walmart',
      nameAr: 'ول مارت',
      slug: 'walmart',
      logo: '🏪',
      website: 'https://walmart.com',
      rating: 4.4,
      reviewCount: 67000,
      country: 'USA',
      productCount: 200000,
      integrationType: 'custom' as const,
      affiliateCommission: 3,
      featured: false,
      verified: true,
    },
    {
      id: 8,
      name: 'Best Buy',
      nameAr: 'بيست باي',
      slug: 'bestbuy',
      logo: '🔌',
      website: 'https://bestbuy.com',
      rating: 4.6,
      reviewCount: 45000,
      country: 'USA',
      productCount: 80000,
      integrationType: 'custom' as const,
      affiliateCommission: 4,
      featured: false,
      verified: true,
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Filter by Category"
              options={categories}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            />
            <Select
              label="Sort By"
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
          {stores.map((store) => (
            <Card key={store.id} hover>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{store.logo}</div>
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        {store.name}
                        {store.verified && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </h3>
                      <p className="text-sm text-gray-400">{store.country}</p>
                    </div>
                  </div>
                  {store.featured && (
                    <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                      Featured
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span className="text-white font-semibold">{store.rating}</span>
                  <span className="text-gray-400 text-sm">({store.reviewCount.toLocaleString()} reviews)</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Products</p>
                    <p className="text-white font-semibold">{store.productCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Commission</p>
                    <p className="text-white font-semibold">{store.affiliateCommission}%</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Globe className="w-4 h-4" />
                  <span>{store.website}</span>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1">{t('viewStoreProducts')}</Button>
                  <Button variant="outline" className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Visit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6">{t('featuredStores')}</h2>
          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stores.filter(s => s.featured).map((store) => (
                <div key={store.id} className="text-center p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-colors cursor-pointer">
                  <div className="text-3xl mb-2">{store.logo}</div>
                  <p className="text-white font-medium text-sm">{store.name}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    <span className="text-xs text-gray-400">{store.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
