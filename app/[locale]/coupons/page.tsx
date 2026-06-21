'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { Copy, Clock, Tag, ExternalLink, CheckCircle } from 'lucide-react';

export default function CouponsPage() {
  const t = useTranslations('coupons');
  const [selectedStore, setSelectedStore] = useState('');
  const [sortBy, setSortBy] = useState('discount');

  const stores = [
    { value: '', label: 'All Stores' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'alibaba', label: 'Alibaba' },
    { value: 'aliexpress', label: 'AliExpress' },
    { value: 'noon', label: 'Noon' },
    { value: 'temu', label: 'Temu' },
  ];

  const sortOptions = [
    { value: 'discount', label: 'Highest Discount' },
    { value: 'expiring', label: 'Expiring Soon' },
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Most Popular' },
  ];

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const mockCoupons = [
    {
      id: 1,
      code: 'SAVE20',
      title: '20% Off Electronics',
      store: 'Amazon',
      discount: 20,
      discountType: 'percentage' as const,
      minPurchase: 50,
      maxDiscount: 100,
      expiresIn: '3 days',
      uses: 1250,
      maxUses: 5000,
      description: 'Get 20% off on all electronics items. Minimum purchase $50.',
    },
    {
      id: 2,
      code: 'FREESHIP',
      title: 'Free Shipping on Orders $50+',
      store: 'AliExpress',
      discount: 0,
      discountType: 'fixed' as const,
      minPurchase: 50,
      expiresIn: '7 days',
      uses: 3400,
      maxUses: 10000,
      description: 'Free shipping on all orders over $50.',
    },
    {
      id: 3,
      code: 'FLASH30',
      title: 'Flash Sale: 30% Off',
      store: 'Noon',
      discount: 30,
      discountType: 'percentage' as const,
      minPurchase: 100,
      maxDiscount: 200,
      expiresIn: '1 day',
      uses: 890,
      maxUses: 2000,
      description: 'Limited time flash sale. 30% off everything.',
    },
    {
      id: 4,
      code: 'NEWUSER15',
      title: '15% Off First Order',
      store: 'Temu',
      discount: 15,
      discountType: 'percentage' as const,
      minPurchase: 25,
      expiresIn: '14 days',
      uses: 5600,
      maxUses: 10000,
      description: 'New customers get 15% off their first order.',
    },
    {
      id: 5,
      code: 'WEEKEND25',
      title: 'Weekend Special: 25% Off',
      store: 'Alibaba',
      discount: 25,
      discountType: 'percentage' as const,
      minPurchase: 200,
      maxDiscount: 500,
      expiresIn: '2 days',
      uses: 450,
      maxUses: 1500,
      description: 'Weekend special offer. 25% off on selected categories.',
    },
    {
      id: 6,
      code: 'SUMMER10',
      title: 'Summer Sale: $10 Off',
      store: 'Amazon',
      discount: 10,
      discountType: 'fixed' as const,
      minPurchase: 75,
      expiresIn: '5 days',
      uses: 2100,
      maxUses: 5000,
      description: '$10 off on all summer collection items.',
    },
  ];

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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
              label="Filter by Store"
              options={stores}
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
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
          {mockCoupons.map((coupon) => (
            <Card key={coupon.id} hover>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold px-4 py-2 rounded-lg text-lg">
                    {coupon.discountType === 'percentage' ? `${coupon.discount}%` : `$${coupon.discount}`}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>{t('expiresIn')} {coupon.expiresIn}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{coupon.title}</h3>
                  <p className="text-sm text-gray-400">{coupon.store}</p>
                </div>

                <p className="text-sm text-gray-300">{coupon.description}</p>

                <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                  <code className="text-lg font-mono text-purple-400">{coupon.code}</code>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(coupon.code)}
                    className="flex items-center gap-2"
                  >
                    {copiedCode === coupon.code ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        {t('codeCopied')}
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        {t('copyCode')}
                      </>
                    )}
                  </Button>
                </div>

                <div className="text-sm text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Min Purchase:</span>
                    <span className="text-white">${coupon.minPurchase}</span>
                  </div>
                  {coupon.maxDiscount && (
                    <div className="flex justify-between">
                      <span>Max Discount:</span>
                      <span className="text-white">${coupon.maxDiscount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Uses:</span>
                    <span className="text-white">{coupon.uses} / {coupon.maxUses}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1">{t('useCoupon')}</Button>
                  <Button variant="outline" className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Visit Store
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline">{t('viewAllCoupons')}</Button>
        </div>
      </div>
    </div>
  );
}
