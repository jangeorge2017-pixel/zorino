'use client';

import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import { FileText, AlertTriangle, Scale, Ban, Gavel, RefreshCw } from 'lucide-react';
import { getContactEmail } from '@/lib/site-url';

export default function TermsPage() {
  const t = useTranslations('terms');
  const legalEmail = getContactEmail('legal');

  const sections = [
    {
      icon: FileText,
      title: 'Introduction',
      content: `
        <p class="mb-4">Welcome to ZORINO. By accessing or using our platform, you agree to be bound by these Terms and Conditions. 
        If you do not agree to these terms, please do not use our service.</p>
        <p>ZORINO is a deal discovery and price comparison platform that helps users find the best prices across various online marketplaces. 
        We earn affiliate commissions when users make purchases through our links.</p>
      `,
    },
    {
      icon: AlertTriangle,
      title: 'User Obligations',
      content: `
        <p class="mb-4">By using ZORINO, you agree to:</p>
        <ul class="list-disc list-inside space-y-2 mb-4">
          <li>Provide accurate and complete information when creating an account</li>
          <li>Maintain the security of your account credentials</li>
          <li>Use the platform for personal, non-commercial purposes</li>
          <li>Not engage in fraudulent or abusive activities</li>
          <li>Respect the intellectual property rights of others</li>
          <li>Not attempt to reverse engineer or hack our systems</li>
        </ul>
      `,
    },
    {
      icon: Scale,
      title: 'Intellectual Property',
      content: `
        <p class="mb-4">All content on ZORINO, including but not limited to text, graphics, logos, images, and software, 
        is the property of ZORINO or its licensors and is protected by copyright laws.</p>
        <p>You may not reproduce, distribute, or create derivative works of our content without prior written consent.</p>
      `,
    },
    {
      icon: Ban,
      title: 'Prohibited Activities',
      content: `
        <p class="mb-4">You are strictly prohibited from:</p>
        <ul class="list-disc list-inside space-y-2 mb-4">
          <li>Using automated tools to scrape or harvest data</li>
          <li>Creating fake accounts or impersonating others</li>
          <li>Posting false or misleading reviews</li>
          <li>Attempting to manipulate affiliate tracking</li>
          <li>Spreading malware or malicious content</li>
          <li>Violating any applicable laws or regulations</li>
        </ul>
      `,
    },
    {
      icon: Gavel,
      title: 'Limitation of Liability',
      content: `
        <p class="mb-4">ZORINO shall not be liable for any indirect, incidental, special, or consequential damages 
        arising from your use of our platform.</p>
        <p>We do not guarantee the accuracy, completeness, or reliability of any deal or product information displayed on our platform. 
        All purchases are made directly through third-party retailers, and we are not responsible for their products or services.</p>
        <p>Our total liability shall not exceed the amount you paid for any premium subscription, if applicable.</p>
      `,
    },
    {
      icon: RefreshCw,
      title: 'Termination',
      content: `
        <p class="mb-4">We reserve the right to terminate or suspend your account at any time, with or without cause, 
        with or without notice.</p>
        <p>Upon termination, your right to use the platform will immediately cease. All provisions of these terms which 
        by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, 
        indemnity, and limitations of liability.</p>
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
            These Terms and Conditions govern your use of the ZORINO platform. Please read them carefully 
            before using our services. By accessing or using ZORINO, you agree to be bound by these terms.
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

        <Card className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-4">Governing Law</h2>
          <p className="text-gray-300 mb-4">
            These Terms and Conditions shall be governed by and construed in accordance with the laws of the United Arab Emirates. 
            Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts of Dubai, UAE.
          </p>
        </Card>

        <Card className="mt-6">
          <h2 className="text-2xl font-bold text-white mb-4">Changes to Terms</h2>
          <p className="text-gray-300 mb-4">
            We reserve the right to modify these Terms and Conditions at any time. Changes will be effective immediately upon posting 
            to the platform. Your continued use of the platform after changes constitutes acceptance of the modified terms.
          </p>
          <p className="text-gray-300">
            We will notify users of significant changes via email or prominent notice on the platform.
          </p>
        </Card>

        <Card className="mt-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30">
          <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
          <p className="text-gray-300 mb-4">
            If you have questions about these Terms and Conditions, please contact us:
          </p>
          <div className="space-y-2">
            <p className="text-white">
              <strong>Email:</strong> {legalEmail}
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
