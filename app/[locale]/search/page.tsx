'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Search, Filter, Star, Heart, ExternalLink } from 'lucide-react';

export default function SearchPage() {
  const t = useTranslations('search');
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(query);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [rating, setRating] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'home', label: 'Home & Garden' },
    { value: 'sports', label: 'Sports' },
  ];

  const stores = [
    { value: '', label: 'All Stores' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'alibaba', label: 'Alibaba' },
    { value: 'aliexpress', label: 'AliExpress' },
    { value: 'noon', label: 'Noon' },
  ];

  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' },
    { value: 'rating', label: 'Rating' },
    { value: 'newest', label: 'Newest' },
  ];

  const ratingOptions = [
    { value: '', label: 'All Ratings' },
    { value: '4', label: '4+ Stars' },
    { value: '3', label: '3+ Stars' },
    { value: '2', label: '2+ Stars' },
  ];

  const mockResults = [
    {
      id: 1,
      name: 'iPhone 15 Pro Max 256GB',
      image: '📱',
      price: 999,
      originalPrice: 1199,
      discount: 17,
      store: 'Amazon',
      rating: 4.8,
      reviewCount: 1250,
      inStock: true,
      category: 'Electronics',
    },
    {
      id: 2,
      name: 'MacBook Air M3 13"',
      image: '💻',
      price: 1099,
      originalPrice: 1299,
      discount: 15,
      store: 'Apple',
      rating: 4.9,
      reviewCount: 890,
      inStock: true,
      category: 'Electronics',
    },
    {
      id: 3,
      name: 'Sony WH-1000XM5 Headphones',
      image: '🎧',
      price: 299,
      originalPrice: 399,
      discount: 25,
      store: 'Amazon',
      rating: 4.7,
      reviewCount: 2340,
      inStock: true,
      category: 'Electronics',
    },
    {
      id: 4,
      name: 'Nike Air Jordan 1',
      image: '👟',
      price: 140,
      originalPrice: 180,
      discount: 22,
      store: 'Nike',
      rating: 4.8,
      reviewCount: 3420,
      inStock: false,
      category: 'Fashion',
    },
    {
      id: 5,
      name: 'Samsung 65" QLED 4K TV',
      image: '📺',
      price: 699,
      originalPrice: 899,
      discount: 22,
      store: 'Best Buy',
      rating: 4.6,
      reviewCount: 567,
      inStock: true,
      category: 'Electronics',
    },
    {
      id: 6,
      name: 'PlayStation 5 Console',
      image: '🎮',
      price: 449,
      originalPrice: 499,
      discount: 10,
      store: 'Amazon',
      rating: 4.9,
      reviewCount: 8900,
      inStock: true,
      category: 'Electronics',
    },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search logic
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">
            {query ? `${t('subtitle')} "${query}"` : t('noResults')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  {t('filters')}
                </h2>
                <Button variant="ghost" size="sm">Clear</Button>
              </div>

              <form onSubmit={handleSearch} className="space-y-6">
                <Input
                  label={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                />

                <Select
                  label="Category"
                  options={categories}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                />

                <Select
                  label="Store"
                  options={stores}
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('priceRange')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder={t('minPrice')}
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                    <Input
                      placeholder={t('maxPrice')}
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>
                </div>

                <Select
                  label={t('rating')}
                  options={ratingOptions}
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                />

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">{t('inStockOnly')}</span>
                </label>

                <Button type="submit" className="w-full">
                  {t('filter')}
                </Button>
              </form>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <span className="text-gray-400">
                {mockResults.length} results found
              </span>
              <Select
                options={sortOptions}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-48"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mockResults.map((product) => (
                <Card key={product.id} hover>
                  <div className="space-y-4">
                    <div className="text-6xl text-center py-4">{product.image}</div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">{product.name}</h3>
                      <p className="text-sm text-gray-400">{product.category} • {product.store}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span>{product.rating}</span>
                      <span>({product.reviewCount} reviews)</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-white">${product.price}</span>
                      {product.originalPrice && (
                        <span className="text-gray-500 line-through">${product.originalPrice}</span>
                      )}
                      {product.discount && (
                        <span className="bg-green-500/20 text-green-400 text-sm font-bold px-2 py-1 rounded">
                          -{product.discount}%
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${product.inStock ? 'text-green-400' : 'text-red-400'}`}>
                        {product.inStock ? t('inStock') : t('outOfStock')}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button className="flex-1">{t('viewDetails')}</Button>
                      <Button variant="outline" size="sm">
                        <Heart className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {mockResults.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">{t('noResults')}</h3>
                <p className="text-gray-400 mb-4">{t('tryDifferentKeywords')}</p>
                <Button onClick={() => setSearchQuery('')}>{t('filter')}</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
