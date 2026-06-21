'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Star, Heart, Share2, ExternalLink, AlertCircle, TrendingUp, CheckCircle, Plus, Minus } from 'lucide-react';

export default function ProductDetailsPage() {
  const t = useTranslations('product');
  const [quantity, setQuantity] = useState(1);
  const [selectedStore, setSelectedStore] = useState(0);
  const [activeTab, setActiveTab] = useState('description');

  const product = {
    id: 1,
    name: 'iPhone 15 Pro Max 256GB',
    nameAr: 'آيفون 15 برو ماكس 256 جيجابايت',
    description: 'The iPhone 15 Pro Max features a stunning 6.7-inch Super Retina XDR display, A17 Pro chip, and advanced camera system with 48MP main camera. Titanium design with Action Button and USB-C.',
    descriptionAr: 'يتميز آيفون 15 برو ماكس بشاشة سوبر ريتينا XDR مقاس 6.7 بوصة، ومعالج A17 Pro، ونظام كاميرا متقدم مع كاميرا رئيسية بدقة 48 ميجابكسل. تصميم تيتانيوم مع زر الإجراء و USB-C.',
    images: ['📱', '📱', '📱'],
    price: 999,
    originalPrice: 1199,
    discount: 17,
    rating: 4.8,
    reviewCount: 1250,
    inStock: true,
    category: 'Electronics',
    specifications: {
      'Display': '6.7" Super Retina XDR',
      'Processor': 'A17 Pro chip',
      'Storage': '256GB',
      'Camera': '48MP Main + 12MP Ultra Wide + 12MP Telephoto',
      'Battery': 'Up to 29 hours video playback',
      'OS': 'iOS 17',
      'Weight': '221g',
      'Dimensions': '159.9 x 76.7 x 8.25 mm',
    },
    stores: [
      {
        id: 1,
        name: 'Amazon',
        logo: '🛒',
        price: 999,
        originalPrice: 1199,
        inStock: true,
        delivery: '2-3 days',
        rating: 4.8,
      },
      {
        id: 2,
        name: 'Apple',
        logo: '🍎',
        price: 1099,
        originalPrice: 1199,
        inStock: true,
        delivery: '1-2 days',
        rating: 4.9,
      },
      {
        id: 3,
        name: 'Best Buy',
        logo: '🔌',
        price: 1049,
        originalPrice: 1199,
        inStock: true,
        delivery: '3-5 days',
        rating: 4.6,
      },
    ],
    reviews: [
      {
        id: 1,
        user: 'John D.',
        rating: 5,
        title: 'Amazing phone!',
        content: 'Best iPhone I\'ve ever owned. The camera is incredible and battery life is fantastic.',
        date: '2024-01-15',
        verified: true,
        helpful: 45,
      },
      {
        id: 2,
        user: 'Sarah M.',
        rating: 4,
        title: 'Great but expensive',
        content: 'Excellent phone but the price is quite high. Worth it if you can afford it.',
        date: '2024-01-10',
        verified: true,
        helpful: 32,
      },
    ],
  };

  const tabs = [
    { id: 'description', label: t('description') },
    { id: 'specifications', label: t('specifications') },
    { id: 'reviews', label: t('reviews') },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-white">Home</a>
          {' > '}
          <a href="/categories" className="hover:text-white">Electronics</a>
          {' > '}
          <span className="text-white">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          {/* Product Images */}
          <div>
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 mb-4">
              <div className="text-9xl text-center">{product.images[0]}</div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {product.images.map((image, index) => (
                <div
                  key={index}
                  className={`bg-gray-900/50 border rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    index === 0 ? 'border-purple-500' : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="text-4xl">{image}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div>
            <div className="mb-4">
              <span className="bg-purple-500/20 text-purple-400 text-sm font-medium px-3 py-1 rounded-full">
                {product.category}
              </span>
            </div>

            <h1 className="text-3xl font-bold text-white mb-4">{product.name}</h1>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
                <span className="text-white font-semibold">{product.rating}</span>
                <span className="text-gray-400">({product.reviewCount} reviews)</span>
              </div>
              <span className={`text-sm ${product.inStock ? 'text-green-400' : 'text-red-400'}`}>
                {product.inStock ? t('inStock') : t('outOfStock')}
              </span>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl font-bold text-white">${product.price}</span>
              {product.originalPrice && (
                <span className="text-2xl text-gray-500 line-through">${product.originalPrice}</span>
              )}
              {product.discount && (
                <span className="bg-green-500/20 text-green-400 text-lg font-bold px-3 py-1 rounded">
                  -{product.discount}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center border border-gray-700 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-6 py-2 text-white font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <Button className="flex-1">{t('addToCart')}</Button>
              <Button variant="outline">
                <Heart className="w-5 h-5" />
              </Button>
              <Button variant="outline">
                <Share2 className="w-5 h-5" />
              </Button>
            </div>

            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">{t('availableAt')}</h3>
              <div className="space-y-3">
                {product.stores.map((store, index) => (
                  <div
                    key={store.id}
                    className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                      selectedStore === index ? 'bg-purple-500/20 border border-purple-500' : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => setSelectedStore(index)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{store.logo}</span>
                      <div>
                        <p className="text-white font-medium">{store.name}</p>
                        <p className="text-sm text-gray-400">Delivery: {store.delivery}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">${store.price}</p>
                      {store.originalPrice && (
                        <p className="text-sm text-gray-500 line-through">${store.originalPrice}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4">
                {t('comparePrices')}
              </Button>
            </Card>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mb-12">
          <div className="flex gap-4 mb-6 border-b border-gray-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 px-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8">
            {activeTab === 'description' && (
              <div>
                <p className="text-gray-300 leading-relaxed">{product.description}</p>
              </div>
            )}

            {activeTab === 'specifications' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-3 border-b border-gray-800">
                      <span className="text-gray-400">{key}</span>
                      <span className="text-white font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="text-5xl font-bold text-white">{product.rating}</div>
                    <div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${i < Math.floor(product.rating) ? 'text-yellow-500 fill-current' : 'text-gray-600'}`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-gray-400">{product.reviewCount} reviews</p>
                    </div>
                  </div>
                  <Button>{t('writeReview')}</Button>
                </div>

                <div className="space-y-6">
                  {product.reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-800 pb-6 last:border-0">
                      <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <span className="text-purple-400 font-semibold">{review.user[0]}</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{review.user}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 fill-current' : 'text-gray-600'}`}
                              />
                            ))}
                          </div>
                          {review.verified && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">{review.date}</span>
                  </div>
                  <h4 className="text-white font-semibold mb-2">{review.title}</h4>
                  <p className="text-gray-300 mb-3">{review.content}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <button className="hover:text-white flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Helpful ({review.helpful})
                    </button>
                    <button className="hover:text-white">Report</button>
                  </div>
                </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Price Alert */}
        <Card className="mb-12">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-purple-500" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">{t('priceAlert')}</h3>
              <p className="text-gray-400">Get notified when the price drops</p>
            </div>
            <Button>Set Alert</Button>
          </div>
        </Card>

        {/* Related Products */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">{t('relatedProducts')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} hover>
                <div className="text-6xl text-center py-4 mb-4">📱</div>
                <h3 className="text-white font-medium mb-2">iPhone 15 Pro {i}</h3>
                <p className="text-purple-400 font-bold mb-4">${899 + i * 100}</p>
                <Button variant="outline" className="w-full">{t('viewDetails')}</Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
