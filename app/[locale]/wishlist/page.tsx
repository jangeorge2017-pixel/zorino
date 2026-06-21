'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Heart, Trash2, ExternalLink, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

export default function WishlistPage() {
  const t = useTranslations('wishlist');
  const { user } = useAuth();
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  const wishlistItems = [
    {
      id: 1,
      name: 'iPhone 15 Pro Max 256GB',
      image: '📱',
      price: 999,
      originalPrice: 1199,
      discount: 17,
      store: 'Amazon',
      rating: 4.8,
      inStock: true,
      priceAlert: 950,
      priceDrop: false,
      addedAt: '2024-01-10',
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
      inStock: true,
      priceAlert: 1000,
      priceDrop: true,
      addedAt: '2024-01-08',
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
      inStock: true,
      priceAlert: 250,
      priceDrop: false,
      addedAt: '2024-01-05',
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
      inStock: false,
      priceAlert: 120,
      priceDrop: false,
      addedAt: '2024-01-03',
    },
  ];

  const toggleSelect = (id: number) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === wishlistItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(wishlistItems.map(item => item.id));
    }
  };

  const removeSelected = () => {
    setSelectedItems([]);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t('loginRequired')}</h2>
          <p className="text-gray-400 mb-6">{t('loginToViewWishlist')}</p>
          <Button onClick={() => router.push('/auth/login')}>{t('login')}</Button>
        </div>
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t('emptyWishlist')}</h2>
          <p className="text-gray-400 mb-6">{t('startAddingProducts')}</p>
          <Button onClick={() => router.push('/')}>{t('browseDeals')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} in your wishlist
          </p>
        </div>

        {/* Actions Bar */}
        {selectedItems.length > 0 && (
          <Card className="mb-6 bg-purple-500/10 border-purple-500/30">
            <div className="flex items-center justify-between">
              <p className="text-white">
                {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => router.push('/compare')}>
                  Compare
                </Button>
                <Button variant="outline" size="sm" className="border-red-500 text-red-400 hover:bg-red-500/10" onClick={removeSelected}>
                  Remove
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Wishlist Items */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <input
              type="checkbox"
              checked={selectedItems.length === wishlistItems.length}
              onChange={toggleSelectAll}
              className="w-5 h-5 rounded"
            />
            <span className="text-gray-400">Select All</span>
          </div>

          {wishlistItems.map((item) => (
            <Card key={item.id} hover>
              <div className="flex items-start gap-6">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="w-5 h-5 rounded mt-4"
                />

                <div className="text-6xl">{item.image}</div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">{item.name}</h3>
                      <p className="text-gray-400 text-sm">{item.store}</p>
                    </div>
                    <button className="text-gray-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-2xl font-bold text-white">${item.price}</span>
                    {item.originalPrice && (
                      <span className="text-gray-500 line-through">${item.originalPrice}</span>
                    )}
                    {item.discount && (
                      <span className="bg-green-500/20 text-green-400 text-sm font-bold px-2 py-1 rounded">
                        -{item.discount}%
                      </span>
                    )}
                    {item.priceDrop && (
                      <span className="bg-purple-500/20 text-purple-400 text-sm font-bold px-2 py-1 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Price Drop!
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <span className={item.inStock ? 'text-green-400' : 'text-red-400'}>
                      {item.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                    <span>⭐ {item.rating}</span>
                    <span>Added {item.addedAt}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button size="sm" disabled={!item.inStock}>
                      {item.inStock ? 'Buy Now' : 'Out of Stock'}
                    </Button>
                    <Button variant="outline" size="sm">
                      Set Alert
                    </Button>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Price Alerts Summary */}
        <Card className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">Price Alerts Summary</h2>
          <div className="space-y-3">
            {wishlistItems.filter(item => item.priceAlert).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{item.image}</span>
                  <div>
                    <p className="text-white font-medium">{item.name}</p>
                    <p className="text-gray-400 text-sm">
                      Current: ${item.price} • Alert: ${item.priceAlert}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.priceDrop ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="text-sm text-gray-400">
                    {item.priceDrop ? 'Below target!' : 'Waiting for drop'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recommendations */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6">You Might Also Like</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} hover>
                <div className="text-5xl text-center py-4 mb-4">📱</div>
                <h3 className="text-white font-medium mb-2">iPhone 15 Pro {i}</h3>
                <p className="text-purple-400 font-bold mb-4">${899 + i * 100}</p>
                <Button variant="outline" size="sm" className="w-full">
                  <Heart className="w-4 h-4 mr-2" />
                  Add to Wishlist
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
