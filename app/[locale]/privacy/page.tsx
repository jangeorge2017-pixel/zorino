'use client';

import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import { Shield, Eye, Lock, User, Database, Globe } from 'lucide-react';
import { getContactEmail } from "@/lib/site-url";

export default function PrivacyPolicyPage() {
  const t = useTranslations('privacy');
  const privacyEmail = getContactEmail('privacy');

  const sections = [
    {
      icon: Eye,
      title: 'Information We Collect',
      content: `
        <p class="mb-4">We collect information you provide directly to us, including:</p>
        <ul class="list-disc list-inside space-y-2 mb-4">
          <li>Account information (name, email, password)</li>
          <li>Profile information (avatar, preferences)</li>
          <li>Search history and browsing behavior</li>
          <li>Wishlist and saved items</li>
          <li>Communication preferences</li>
        </ul>
        <p>We also collect information automatically through cookies and similar technologies.</p>
      `,
    },
    {
      icon: Database,
      title: 'How We Use Your Information',
      content: `
        <p class="mb-4">We use your information to:</p>
        <ul class="list-disc list-inside space-y-2 mb-4">
          <li>Provide and improve our services</li>
          <li>Personalize your experience</li>
          <li>Send you relevant deals and notifications</li>
          <li>Process transactions and affiliate commissions</li>
          <li>Analyze usage patterns to enhance features</li>
          <li>Prevent fraud and ensure security</li>
        </ul>
      `,
    },
    {
      icon: Globe,
      title: 'Information Sharing',
      content: `
        <p class="mb-4">We may share your information with:</p>
        <ul class="list-disc list-inside space-y-2 mb-4">
          <li>Partner stores for affiliate tracking (with your consent)</li>
          <li>Service providers who assist our operations</li>
          <li>Legal authorities when required by law</li>
          <li>Third parties in the event of a business transfer</li>
        </ul>
        <p>We never sell your personal information to third parties.</p>
      `,
    },
    {
      icon: Lock,
      title: 'Data Security',
      content: `
        <p class="mb-4">We implement industry-standard security measures to protect your information:</p>
        <ul class="list-disc list-inside space-y-2 mb-4">
          <li>Encryption of data in transit and at rest</li>
          <li>Regular security audits and updates</li>
          <li>Access controls and authentication systems</li>
          <li>Secure data storage practices</li>
          <li>Breach detection and response procedures</li>
        </ul>
      `,
    },
    {
      icon: User,
      title: 'Your Rights',
      content: `
        <p class="mb-4">You have the right to:</p>
        <ul class="list-disc list-inside space-y-2 mb-4">
          <li>Access your personal information</li>
          <li>Correct inaccurate information</li>
          <li>Delete your account and data</li>
          <li>Opt out of marketing communications</li>
          <li>Export your data</li>
          <li>Object to processing of your data</li>
        </ul>
        <p>Contact us at ${privacyEmail} to exercise these rights.</p>
      `,
    },
    {
      icon: Shield,
      title: 'Cookies and Tracking',
      content: `
        <p class="mb-4">We use cookies and similar technologies to:</p>
        <ul class="list-disc list-inside space-y-2 mb-4">
          <li>Remember your preferences and settings</li>
          <li>Analyze website traffic and usage patterns</li>
          <li>Personalize content and recommendations</li>
          <li>Track affiliate conversions</li>
        </ul>
        <p>You can manage cookie preferences through your browser settings.</p>
      `,
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">
            {t('lastUpdated')}: January 15, 2024
          </p>
        </div>

        <Card className="mb-8">
          <p className="text-gray-300 leading-relaxed">
            At ZORINO, we take your privacy seriously. This Privacy Policy explains how we collect, 
            use, and protect your personal information when you use our platform. By using ZORINO, 
            you agree to the practices described in this policy.
          </p>
        </Card>

        {sections.map((section, index) => (
          <Card key={index} className="mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <section.icon className="w-6 h-6 text-purple-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white mb-4">{section.title}</h2>
                <div 
                  className="text-gray-300 leading-relaxed prose prose-invert prose-sm"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              </div>
            </div>
          </Card>
        ))}

        <Card className="mt-8 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30">
          <h2 className="text-2xl font-bold text-white mb-4">{t('contactUs')}</h2>
          <p className="text-gray-300 mb-4">
            If you have questions about this Privacy Policy or our data practices, please contact us:
          </p>
          <div className="space-y-2">
            <p className="text-white">
              <strong>Email:</strong> {privacyEmail}
            </p>
            <p className="text-white">
              <strong>Address:</strong> 123 Tech Street, Dubai, UAE
            </p>
          </div>
        </Card>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Last updated: January 15, 2024</p>
        </div>
      </div>
    </div>
  );
}
