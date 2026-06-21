'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Card from '@/components/ui/Card';
import { ChevronDown, ChevronUp, HelpCircle, MessageCircle, ShoppingBag, CreditCard, Truck, RefreshCw, Shield, User } from 'lucide-react';

export default function FAQPage() {
  const t = useTranslations('faq');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const categories = [
    {
      id: 'general',
      icon: HelpCircle,
      title: 'General',
      questions: [
        {
          q: 'What is ZORINO?',
          a: 'ZORINO is an AI-powered deal discovery and price comparison platform that helps you find the best prices across thousands of online stores. We aggregate deals, track prices, and provide personalized recommendations to help you save money.',
        },
        {
          q: 'Is ZORINO free to use?',
          a: 'Yes! ZORINO is completely free for shoppers. We earn small affiliate commissions from partner stores when you make purchases through our links, which helps us maintain and improve our platform.',
        },
        {
          q: 'How does ZORINO make money?',
          a: 'We earn affiliate commissions when you click on our links and make purchases from partner stores. This doesn\'t affect the price you pay - you still get the same deal, and we get a small commission from the retailer.',
        },
      ],
    },
    {
      id: 'account',
      icon: User,
      title: 'Account',
      questions: [
        {
          q: 'How do I create an account?',
          a: 'Click the "Register" button in the top right corner of the page. You can sign up with your email address or use social login options like Google or Facebook for quick registration.',
        },
        {
          q: 'Can I use ZORINO without an account?',
          a: 'Yes, you can browse deals and search for products without an account. However, creating an account allows you to save wishlists, set price alerts, and receive personalized recommendations.',
        },
        {
          q: 'How do I reset my password?',
          a: 'Click "Forgot Password" on the login page, enter your email address, and we\'ll send you a password reset link. Follow the instructions in the email to create a new password.',
        },
      ],
    },
    {
      id: 'deals',
      icon: ShoppingBag,
      title: 'Deals & Coupons',
      questions: [
        {
          q: 'How do I find the best deals?',
          a: 'Use our search bar to find specific products, browse by category, or check our Deals and Coupons pages. You can also set up price alerts to be notified when prices drop.',
        },
        {
          q: 'How do coupon codes work?',
          a: 'Find a coupon code on our Coupons page, copy it, and apply it at checkout on the retailer\'s website. Each coupon has specific terms and conditions, so make sure to read them before using.',
        },
        {
          q: 'Are the deals verified?',
          a: 'Yes, we verify all deals before listing them. We regularly update our listings to ensure accuracy and remove expired or invalid deals.',
        },
      ],
    },
    {
      id: 'payments',
      icon: CreditCard,
      title: 'Payments',
      questions: [
        {
          q: 'Do I pay through ZORINO?',
          a: 'No, all purchases are made directly through the retailer\'s website. ZORINO helps you find deals, but we don\'t process payments or handle transactions.',
        },
        {
          q: 'Is my payment information safe?',
          a: 'Absolutely. Since we don\'t process payments, we never see or store your payment information. All transactions are handled securely by the retailers themselves.',
        },
        {
          q: 'What payment methods are accepted?',
          a: 'Payment methods vary by retailer. Most accept credit/debit cards, PayPal, and sometimes other options like Apple Pay or Google Pay. Check the retailer\'s checkout page for available options.',
        },
      ],
    },
    {
      id: 'shipping',
      icon: Truck,
      title: 'Shipping',
      questions: [
        {
          q: 'Who handles shipping?',
          a: 'Shipping is handled entirely by the retailer you purchase from. ZORINO doesn\'t ship products or handle delivery.',
        },
        {
          q: 'How do I track my order?',
          a: 'After making a purchase, you\'ll receive an order confirmation email from the retailer with tracking information. Use that tracking number on the retailer\'s website to track your shipment.',
        },
        {
          q: 'What if I need to return an item?',
          a: 'Returns are handled by the retailer according to their return policy. Contact the retailer\'s customer service directly to initiate a return or exchange.',
        },
      ],
    },
    {
      id: 'technical',
      icon: RefreshCw,
      title: 'Technical',
      questions: [
        {
          q: 'How do price alerts work?',
          a: 'Set a price alert for any product by clicking the "Set Alert" button on the product page. We\'ll email you when the price drops below your target price.',
        },
        {
          q: 'How do I use the compare feature?',
          a: 'Add products to your comparison list by clicking the "Add to Compare" button. You can compare up to 4 products side-by-side to see their specifications and prices.',
        },
        {
          q: 'Is my data secure?',
          a: 'Yes, we use industry-standard encryption and security measures to protect your data. We never sell your personal information to third parties.',
        },
      ],
    },
  ];

  const toggleQuestion = (categoryIndex: number, questionIndex: number) => {
    const index = categoryIndex * 100 + questionIndex;
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => document.getElementById(category.id)?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-center hover:border-purple-500 transition-colors"
            >
              <category.icon className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <span className="text-white text-sm">{category.title}</span>
            </button>
          ))}
        </div>

        {/* FAQ Categories */}
        {categories.map((category, catIndex) => (
          <div key={category.id} id={category.id} className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <category.icon className="w-6 h-6 text-purple-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">{category.title}</h2>
            </div>

            <div className="space-y-4">
              {category.questions.map((faq, qIndex) => {
                const isOpen = openIndex === catIndex * 100 + qIndex;
                return (
                  <Card key={qIndex}>
                    <button
                      onClick={() => toggleQuestion(catIndex, qIndex)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold pr-4">{faq.q}</h3>
                        {isOpen ? (
                          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                      {isOpen && (
                        <p className="text-gray-300 mt-4 leading-relaxed">{faq.a}</p>
                      )}
                    </button>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

        {/* Contact CTA */}
        <Card className="mt-12 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30">
          <div className="text-center">
            <Shield className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Still Have Questions?</h2>
            <p className="text-gray-400 mb-6">
              Can't find the answer you're looking for? Our support team is here to help.
            </p>
            <div className="flex gap-4 justify-center">
              <button className="bg-white text-purple-600 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors">
                Contact Support
              </button>
              <button className="border-2 border-white text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors">
                Live Chat
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
