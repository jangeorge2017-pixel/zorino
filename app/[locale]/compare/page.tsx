'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { X, Plus, Check, AlertCircle } from 'lucide-react';

export default function ComparePage() {
  const t = useTranslations('compare');
  
  const [products, setProducts] = useState([
    {
      id: 1,
      name: 'iPhone 15 Pro Max 256GB',
      image: '📱',
      price: 999,
      originalPrice: 1199,
      store: 'Amazon',
      rating: 4.8,
      reviewCount: 1250,
      inStock: true,
      specifications: {
        'Display': '6.7" Super Retina XDR',
        'Processor': 'A17 Pro chip',
        'Storage': '256GB',
        'Camera': '48MP Main + 12MP Ultra Wide + 12MP Telephoto',
        'Battery': 'Up to 29 hours video playback',
        'OS': 'iOS 17',
        'Weight': '221g',
        'Water Resistance': 'IP68',
        '5G': 'Yes',
        'Wireless Charging': 'Yes',
      },
    },
    {
      id: 2,
      name: 'Samsung Galaxy S24 Ultra',
      image: '📱',
      price: 1199,
      originalPrice: 1299,
      store: 'Samsung',
      rating: 4.7,
      reviewCount: 890,
      inStock: true,
      specifications: {
        'Display': '6.8" Dynamic AMOLED 2X',
        'Processor': 'Snapdragon 8 Gen 3',
        'Storage': '256GB',
        'Camera': '200MP Main + 12MP Ultra Wide + 50MP Telephoto',
        'Battery': '5000mAh',
        'OS': 'Android 14',
        'Weight': '232g',
        'Water Resistance': 'IP68',
        '5G': 'Yes',
        'Wireless Charging': 'Yes',
      },
    },
    {
      id: 3,
      name: 'Google Pixel 8 Pro',
      image: '📱',
      price: 899,
      originalPrice: 999,
      store: 'Google',
      rating: 4.6,
      reviewCount: 670,
      inStock: true,
      specifications: {
        'Display': '6.7" LTPO OLED',
        'Processor': 'Google Tensor G3',
        'Storage': '256GB',
        'Camera': '50MP Main + 48MP Ultra Wide + 48MP Telephoto',
        'Battery': '5050mAh',
        'OS': 'Android 14',
        'Weight': '213g',
        'Water Resistance': 'IP68',
        '5G': 'Yes',
        'Wireless Charging': 'Yes',
      },
    },
  ]);

  const removeProduct = (id: number) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const allSpecs = Array.from(new Set(products.flatMap(p => Object.keys(p.specifications))));

  const getSpecValue = (product: any, spec: string) => {
    return product.specifications[spec] || '-';
  };

  const areSpecsEqual = (spec: string) => {
    const values = products.map(p => getSpecValue(p, spec));
    return values.every(v => v === values[0]);
  };

  if (products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚖️</div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('noProductsToCompare')}</h2>
          <p className="text-gray-400 mb-6">{t('selectProducts')}</p>
          <Button>Add Products</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        {/* Product Headers */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="md:col-span-1">
            <h3 className="text-lg font-semibold text-white mb-4">Products</h3>
          </div>
          {products.map((product) => (
            <Card key={product.id} className="relative">
              <button
                onClick={() => removeProduct(product.id)}
                className="absolute top-2 right-2 p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
              <div className="text-5xl text-center py-4 mb-4">{product.image}</div>
              <h4 className="text-white font-medium text-center mb-2">{product.name}</h4>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">${product.price}</p>
                {product.originalPrice && (
                  <p className="text-sm text-gray-500 line-through">${product.originalPrice}</p>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-400">
                <span>⭐ {product.rating}</span>
                <span>({product.reviewCount})</span>
              </div>
              <Button className="w-full mt-4" size="sm">
                {t('viewDetails')}
              </Button>
            </Card>
          ))}
          {products.length < 4 && (
            <Card className="flex items-center justify-center min-h-[300px] border-dashed border-2 border-gray-700 hover:border-purple-500 transition-colors cursor-pointer">
              <div className="text-center">
                <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">{t('addProduct')}</p>
              </div>
            </Card>
          )}
        </div>

        {/* Comparison Table */}
        <Card className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {/* Price Row */}
              <tr className="border-b border-gray-800">
                <td className="py-4 px-4 text-gray-400 font-medium">Price</td>
                {products.map((product) => (
                  <td key={product.id} className="py-4 px-4">
                    <div className="text-2xl font-bold text-white">${product.price}</div>
                    {product.originalPrice && (
                      <div className="text-sm text-gray-500 line-through">${product.originalPrice}</div>
                    )}
                  </td>
                ))}
                {products.length < 4 && (
                  <td className="py-4 px-4"></td>
                )}
              </tr>

              {/* Rating Row */}
              <tr className="border-b border-gray-800">
                <td className="py-4 px-4 text-gray-400 font-medium">Rating</td>
                {products.map((product) => (
                  <td key={product.id} className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">⭐ {product.rating}</span>
                      <span className="text-gray-400 text-sm">({product.reviewCount})</span>
                    </div>
                  </td>
                ))}
                {products.length < 4 && (
                  <td className="py-4 px-4"></td>
                )}
              </tr>

              {/* Stock Row */}
              <tr className="border-b border-gray-800">
                <td className="py-4 px-4 text-gray-400 font-medium">Availability</td>
                {products.map((product) => (
                  <td key={product.id} className="py-4 px-4">
                    <span className={product.inStock ? 'text-green-400' : 'text-red-400'}>
                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                ))}
                {products.length < 4 && (
                  <td className="py-4 px-4"></td>
                )}
              </tr>

              {/* Specifications */}
              {allSpecs.map((spec) => (
                <tr key={spec} className={`border-b border-gray-800 ${areSpecsEqual(spec) ? 'bg-purple-500/5' : ''}`}>
                  <td className="py-4 px-4 text-gray-400 font-medium">
                    {spec}
                    {areSpecsEqual(spec) && (
                      <Check className="inline w-4 h-4 text-green-500 ml-2" />
                    )}
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="py-4 px-4 text-white">
                      {getSpecValue(product, spec)}
                    </td>
                  ))}
                  {products.length < 4 && (
                    <td className="py-4 px-4"></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Summary */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Check className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-white">{t('similarities')}</h3>
            </div>
            <div className="space-y-2">
              {allSpecs.filter(areSpecsEqual).map((spec) => (
                <div key={spec} className="flex items-center gap-2 text-gray-300">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{spec}: {getSpecValue(products[0], spec)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-white">{t('differences')}</h3>
            </div>
            <div className="space-y-2">
              {allSpecs.filter(spec => !areSpecsEqual(spec)).map((spec) => (
                <div key={spec} className="text-gray-300">
                  <span className="font-medium">{spec}:</span> varies between products
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <Button className="flex-1">Clear All</Button>
          <Button variant="outline" className="flex-1">Share Comparison</Button>
        </div>
      </div>
    </div>
  );
}
