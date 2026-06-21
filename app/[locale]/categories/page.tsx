'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ArrowRight, Grid3X3, List } from 'lucide-react';

export default function CategoriesPage() {
  const t = useTranslations('categories');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories = [
    {
      id: 1,
      name: 'Electronics',
      nameAr: 'إلكترونيات',
      icon: '💻',
      slug: 'electronics',
      productCount: 15420,
      subcategories: ['Phones', 'Laptops', 'Tablets', 'Cameras', 'Audio'],
      featured: true,
    },
    {
      id: 2,
      name: 'Fashion',
      nameAr: 'أزياء',
      icon: '👗',
      slug: 'fashion',
      productCount: 28930,
      subcategories: ['Men', 'Women', 'Kids', 'Shoes', 'Accessories'],
      featured: true,
    },
    {
      id: 3,
      name: 'Home & Garden',
      nameAr: 'المنزل والحديقة',
      icon: '🏠',
      slug: 'home-garden',
      productCount: 12500,
      subcategories: ['Furniture', 'Decor', 'Kitchen', 'Garden', 'Tools'],
      featured: false,
    },
    {
      id: 4,
      name: 'Sports & Outdoors',
      nameAr: 'الرياضة والهواء الطلق',
      icon: '⚽',
      slug: 'sports-outdoors',
      productCount: 8900,
      subcategories: ['Fitness', 'Team Sports', 'Outdoor', 'Camping', 'Water Sports'],
      featured: true,
    },
    {
      id: 5,
      name: 'Toys & Games',
      nameAr: 'ألعاب',
      icon: '🎮',
      slug: 'toys-games',
      productCount: 6700,
      subcategories: ['Video Games', 'Board Games', 'Educational', 'Action Figures', 'Dolls'],
      featured: false,
    },
    {
      id: 6,
      name: 'Beauty & Health',
      nameAr: 'الجمال والصحة',
      icon: '💄',
      slug: 'beauty-health',
      productCount: 11200,
      subcategories: ['Skincare', 'Makeup', 'Hair Care', 'Fragrances', 'Health'],
      featured: true,
    },
    {
      id: 7,
      name: 'Automotive',
      nameAr: 'سيارات',
      icon: '🚗',
      slug: 'automotive',
      productCount: 5400,
      subcategories: ['Parts', 'Accessories', 'Tools', 'Electronics', 'Care'],
      featured: false,
    },
    {
      id: 8,
      name: 'Books & Media',
      nameAr: 'كتب ووسائط',
      icon: '📚',
      slug: 'books-media',
      productCount: 32000,
      subcategories: ['Books', 'Movies', 'Music', 'Games', 'Educational'],
      featured: false,
    },
    {
      id: 9,
      name: 'Food & Grocery',
      nameAr: 'طعام وبقالة',
      icon: '🍎',
      slug: 'food-grocery',
      productCount: 18900,
      subcategories: ['Fresh Food', 'Pantry', 'Beverages', 'Snacks', 'Organic'],
      featured: false,
    },
    {
      id: 10,
      name: 'Baby & Kids',
      nameAr: 'رضع وأطفال',
      icon: '👶',
      slug: 'baby-kids',
      productCount: 7800,
      subcategories: ['Clothing', 'Gear', 'Toys', 'Furniture', 'Feeding'],
      featured: false,
    },
    {
      id: 11,
      name: 'Pet Supplies',
      nameAr: 'لوازم الحيوانات الأليفة',
      icon: '🐕',
      slug: 'pet-supplies',
      productCount: 4500,
      subcategories: ['Food', 'Toys', 'Accessories', 'Health', 'Grooming'],
      featured: false,
    },
    {
      id: 12,
      name: 'Office Supplies',
      nameAr: 'لوازم المكتب',
      icon: '📝',
      slug: 'office-supplies',
      productCount: 6200,
      subcategories: ['Paper', 'Desk', 'Electronics', 'Furniture', 'Storage'],
      featured: false,
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-gray-400">
            {categories.length} {t('categories')}
          </span>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Card key={category.id} hover className="text-center">
                <div className="text-5xl mb-4">{category.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-1">{category.name}</h3>
                <p className="text-sm text-gray-400 mb-3">{category.productCount.toLocaleString()} products</p>
                <div className="flex flex-wrap gap-1 justify-center mb-4">
                  {category.subcategories.slice(0, 3).map((sub) => (
                    <span key={sub} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                      {sub}
                    </span>
                  ))}
                  {category.subcategories.length > 3 && (
                    <span className="text-xs text-gray-400">+{category.subcategories.length - 3}</span>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  {t('viewAll')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <Card key={category.id} hover className="flex items-center gap-6">
                <div className="text-5xl">{category.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-1">{category.name}</h3>
                  <p className="text-sm text-gray-400 mb-2">{category.productCount.toLocaleString()} products</p>
                  <div className="flex flex-wrap gap-2">
                    {category.subcategories.map((sub) => (
                      <span key={sub} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
                <Button variant="outline">
                  {t('viewAll')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
