'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { Mail, Phone, MapPin, Send, CheckCircle, MessageSquare, HeadphonesIcon } from 'lucide-react';
import { getContactEmail } from '@/lib/site-url';

export default function ContactPage() {
  const t = useTranslations('contact');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  const contactInfo = [
    {
      icon: Mail,
      label: 'Email',
      value: getContactEmail('support'),
      link: `mailto:${getContactEmail('support')}`,
    },
    {
      icon: Phone,
      label: 'Phone',
      value: '+1 (555) 123-4567',
      link: 'tel:+15551234567',
    },
    {
      icon: MapPin,
      label: 'Address',
      value: '123 Tech Street, Dubai, UAE',
      link: null,
    },
  ];

  const supportOptions = [
    {
      icon: MessageSquare,
      title: 'General Inquiries',
      description: 'Questions about our platform, features, or services',
      email: getContactEmail('info'),
    },
    {
      icon: HeadphonesIcon,
      title: 'Technical Support',
      description: 'Help with technical issues, bugs, or account problems',
      email: getContactEmail('support'),
    },
    {
      icon: Send,
      title: 'Partnerships',
      description: 'Business partnerships, affiliate programs, or collaborations',
      email: getContactEmail('partnerships'),
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <Card>
              <h2 className="text-2xl font-bold text-white mb-6">{t('sendMessage')}</h2>
              
              {isSubmitted ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">{t('messageSent')}</h3>
                  <p className="text-gray-400">We'll get back to you within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Input
                    label={t('yourName')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                  
                  <Input
                    label={t('yourEmail')}
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    required
                  />
                  
                  <Input
                    label={t('subject')}
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="How can we help?"
                    required
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('message')}
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us more about your inquiry..."
                      rows={6}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? t('pleaseWait') : t('sendMessage')}
                  </Button>
                </form>
              )}
            </Card>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <Card>
              <h2 className="text-2xl font-bold text-white mb-6">{t('contactInfo')}</h2>
              <div className="space-y-4">
                {contactInfo.map((info, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <info.icon className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">{info.label}</p>
                      {info.link ? (
                        <a
                          href={info.link}
                          className="text-white font-medium hover:text-purple-400 transition-colors"
                        >
                          {info.value}
                        </a>
                      ) : (
                        <p className="text-white font-medium">{info.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-2xl font-bold text-white mb-6">Support Options</h2>
              <div className="space-y-4">
                {supportOptions.map((option, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <option.icon className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">{option.title}</h3>
                      <p className="text-gray-400 text-sm mb-2">{option.description}</p>
                      <a
                        href={`mailto:${option.email}`}
                        className="text-purple-400 text-sm hover:text-purple-300"
                      >
                        {option.email}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30">
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Need Immediate Help?</h3>
                <p className="text-gray-400 mb-4">
                  Check our FAQ section for quick answers to common questions.
                </p>
                <Button variant="outline" className="w-full">
                  Visit FAQ
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* FAQ Preview */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: 'How do I find the best deals?',
                a: 'Use our search and filter options to browse deals by category, store, or discount percentage. You can also set up price alerts for specific products.',
              },
              {
                q: 'Is ZORINO free to use?',
                a: 'Yes! ZORINO is completely free for shoppers. We earn small commissions from our partner stores when you make a purchase through our links.',
              },
              {
                q: 'How do price alerts work?',
                a: 'Set a price alert for any product, and we\'ll notify you via email when the price drops below your target price.',
              },
              {
                q: 'Can I trust the deals listed?',
                a: 'All deals are verified and sourced from reputable stores. We regularly update our listings to ensure accuracy and availability.',
              },
            ].map((faq, index) => (
              <Card key={index} hover>
                <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                <p className="text-gray-400 text-sm">{faq.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
