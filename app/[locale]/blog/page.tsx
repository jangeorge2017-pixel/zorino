'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { Calendar, Clock, User, Tag, ArrowRight } from 'lucide-react';

export default function BlogPage() {
  const t = useTranslations('blog');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'deals', label: 'Deals & Discounts' },
    { value: 'guides', label: 'Shopping Guides' },
    { value: 'reviews', label: 'Product Reviews' },
    { value: 'tips', label: 'Money Saving Tips' },
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'oldest', label: 'Oldest First' },
  ];

  const posts = [
    {
      id: 1,
      title: '10 Best Black Friday Deals 2024',
      titleAr: 'أفضل 10 صفقات الجمعة السوداء 2024',
      slug: 'best-black-friday-deals-2024',
      excerpt: 'Discover the hottest Black Friday deals across all major retailers. We\'ve curated the best discounts on electronics, fashion, and more.',
      excerptAr: 'اكتشف أ hottest صفقات الجمعة السوداء عبر جميع تجار التجزئة الرئيسيين. قمنا باختيار أفضل الخصومات على الإلكترونيات والأزياء والمزيد.',
      image: '🛍️',
      author: 'Sarah Johnson',
      category: 'Deals & Discounts',
      tags: ['Black Friday', 'Deals', 'Shopping'],
      publishedAt: '2024-01-15',
      readingTime: '8 min read',
      views: 15420,
      featured: true,
    },
    {
      id: 2,
      title: 'How to Find the Best Deals Online',
      titleAr: 'كيف تجد أفضل الصفقات عبر الإنترنت',
      slug: 'how-to-find-best-deals-online',
      excerpt: 'Master the art of online shopping with our comprehensive guide to finding the best deals, using price comparison tools, and timing your purchases.',
      excerptAr: 'أتقن فن التسوق عبر الإنترنت مع دليلنا الشامل للعثور على أفضل الصفقات واستخدام أدوات مقارنة الأسعار وتوقيت مشترياتك.',
      image: '💡',
      author: 'Mike Chen',
      category: 'Shopping Guides',
      tags: ['Tips', 'Guides', 'Shopping'],
      publishedAt: '2024-01-12',
      readingTime: '12 min read',
      views: 8930,
      featured: true,
    },
    {
      id: 3,
      title: 'Amazon vs AliExpress: Where to Shop?',
      titleAr: 'أمازون ضد علي إكسبريس: أين تتسوق؟',
      slug: 'amazon-vs-aliexpress-where-to-shop',
      excerpt: 'A detailed comparison between Amazon and AliExpress to help you decide which marketplace offers better deals for your shopping needs.',
      excerptAr: 'مقارنة تفصيلية بين أمازون وعلي إكسبريس لمساعدتك في تحديد أي سوق يقدم صفقات أفضل لاحتياجات التسوق الخاصة بك.',
      image: '⚖️',
      author: 'Emma Wilson',
      category: 'Product Reviews',
      tags: ['Comparison', 'Amazon', 'AliExpress'],
      publishedAt: '2024-01-10',
      readingTime: '10 min read',
      views: 12500,
      featured: false,
    },
    {
      id: 4,
      title: '5 Money-Saving Apps You Need',
      titleAr: '5 تطبيقات توفير المال تحتاجها',
      slug: 'money-saving-apps-you-need',
      excerpt: 'Discover the top money-saving apps that can help you track expenses, find coupons, and get cashback on your purchases.',
      excerptAr: 'اكتشف أفضل تطبيقات توفير المال التي يمكن أن تساعدك في تتبع النفقات والعثور على القسائم والحصول على استرداد نقدي على مشترياتك.',
      image: '💰',
      author: 'David Lee',
      category: 'Money Saving Tips',
      tags: ['Apps', 'Money', 'Tips'],
      publishedAt: '2024-01-08',
      readingTime: '6 min read',
      views: 6780,
      featured: false,
    },
    {
      id: 5,
      title: 'Complete Guide to Noon Deals',
      titleAr: 'دليل شامل لصفقات نون',
      slug: 'complete-guide-to-noon-deals',
      excerpt: 'Everything you need to know about finding and using deals on Noon, the Middle East\'s fastest-growing e-commerce platform.',
      excerptAr: 'كل ما تحتاج معرفته عن العثور على صفقات واستخدامها على نون، أسرع منصة تجارة إلكترونية نموًا في الشرق الأوسط.',
      image: '🌙',
      author: 'Fatima Al-Rashid',
      category: 'Shopping Guides',
      tags: ['Noon', 'Deals', 'Middle East'],
      publishedAt: '2024-01-05',
      readingTime: '9 min read',
      views: 4560,
      featured: false,
    },
    {
      id: 6,
      title: 'Temu vs Shein: Fashion Showdown',
      titleAr: 'تيمو ضد شين: مواجهة الأزياء',
      slug: 'temu-vs-shein-fashion-showdown',
      excerpt: 'Compare Temu and Shein to find out which platform offers better prices, quality, and shipping options for fashion items.',
      excerptAr: 'قارن بين تيمو وشين لمعرفة أي منصة تقدم أسعارًا وجودة وخيارات شحن أفضل لمستلزمات الأزياء.',
      image: '👗',
      author: 'Lisa Park',
      category: 'Product Reviews',
      tags: ['Fashion', 'Temu', 'Shein'],
      publishedAt: '2024-01-03',
      readingTime: '7 min read',
      views: 7890,
      featured: false,
    },
  ];

  const featuredPost = posts.find(p => p.featured);
  const regularPosts = posts.filter(p => !p.featured);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        {/* Filters */}
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label={t('categories')}
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
              <Button className="w-full">Apply Filters</Button>
            </div>
          </div>
        </div>

        {/* Featured Post */}
        {featuredPost && (
          <Card hover className="mb-12 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="text-9xl flex items-center justify-center bg-gray-800/50 rounded-2xl p-8">
                {featuredPost.image}
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-4">
                  <span className="bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                    Featured
                  </span>
                  <span className="text-gray-400 text-sm">{featuredPost.category}</span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">{featuredPost.title}</h2>
                <p className="text-gray-300 mb-6">{featuredPost.excerpt}</p>
                <div className="flex items-center gap-6 text-sm text-gray-400 mb-6">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{featuredPost.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{featuredPost.publishedAt}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{featuredPost.readingTime}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {featuredPost.tags.map((tag) => (
                    <span key={tag} className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
                <Button>
                  {t('readArticle')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Regular Posts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regularPosts.map((post) => (
            <Card key={post.id} hover>
              <div className="text-6xl text-center py-6 mb-4">{post.image}</div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-400 text-sm font-medium">{post.category}</span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400 text-sm">{post.publishedAt}</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 line-clamp-2">{post.title}</h3>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{post.excerpt}</p>
              <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{post.author}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{post.readingTime}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full">
                {t('readArticle')}
              </Button>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="mt-12 text-center">
          <Button variant="outline">Load More Articles</Button>
        </div>

        {/* Newsletter */}
        <Card className="mt-12 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-2">Subscribe to Our Newsletter</h3>
            <p className="text-gray-400 mb-6">Get the latest deals and shopping tips delivered to your inbox</p>
            <div className="flex gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <Button>Subscribe</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
