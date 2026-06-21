'use client';

import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import { Target, Eye, Heart, Users, Globe, Zap, Shield, Award } from 'lucide-react';

export default function AboutPage() {
  const t = useTranslations('about');

  const values = [
    {
      icon: Target,
      title: 'Mission',
      description: 'To empower shoppers worldwide with the tools and information they need to make informed purchasing decisions and save money on every purchase.',
    },
    {
      icon: Eye,
      title: 'Vision',
      description: 'To become the world\'s leading platform for deal discovery, price comparison, and smart shopping, trusted by millions of consumers globally.',
    },
    {
      icon: Heart,
      title: 'Values',
      description: 'We believe in transparency, user privacy, and delivering real value to our community. Your trust is our greatest asset.',
    },
  ];

  const stats = [
    { icon: Users, label: 'Active Users', value: '2M+' },
    { icon: Globe, label: 'Countries', value: '150+' },
    { icon: Zap, label: 'Deals Found', value: '50M+' },
    { icon: Award, label: 'Money Saved', value: '$500M+' },
  ];

  const team = [
    {
      name: 'Ahmed Hassan',
      role: 'CEO & Founder',
      image: '👨‍💼',
      bio: 'Passionate about making shopping smarter and more affordable for everyone.',
    },
    {
      name: 'Sarah Johnson',
      role: 'CTO',
      image: '👩‍💻',
      bio: 'Tech visionary with 15+ years of experience in e-commerce and AI.',
    },
    {
      name: 'Mohammed Ali',
      role: 'Head of Product',
      image: '👨‍🎨',
      bio: 'Product expert focused on creating seamless user experiences.',
    },
    {
      name: 'Fatima Al-Rashid',
      role: 'Head of Marketing',
      image: '👩‍🎤',
      bio: 'Marketing strategist with a passion for connecting with communities.',
    },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">{t('title')}</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Mission, Vision, Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {values.map((value, index) => (
            <Card key={index} hover>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-8 h-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{value.title}</h3>
                <p className="text-gray-400">{value.description}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Story Section */}
        <Card className="mb-16 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">{t('story')}</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                ZORINO was founded in 2023 with a simple yet powerful idea: make shopping smarter for everyone. 
                We noticed that consumers were overwhelmed by the sheer number of online stores, deals, and options available.
                Finding the best price required visiting multiple websites, using complex comparison tools, and spending hours researching.
              </p>
              <p className="text-gray-300 leading-relaxed mb-4">
                Our team of e-commerce experts and AI engineers set out to solve this problem. We built a platform that 
                aggregates deals from thousands of stores, uses AI to find the best prices, and provides personalized 
                recommendations based on your shopping habits.
              </p>
              <p className="text-gray-300 leading-relaxed">
                Today, ZORINO helps millions of shoppers worldwide save money and time. We're committed to continuously 
                improving our platform and adding new features to make your shopping experience even better.
              </p>
            </div>
            <div className="text-9xl text-center">🚀</div>
          </div>
        </Card>

        {/* Team Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">{t('team')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member, index) => (
              <Card key={index} hover>
                <div className="text-center">
                  <div className="text-6xl mb-4">{member.image}</div>
                  <h3 className="text-lg font-semibold text-white mb-1">{member.name}</h3>
                  <p className="text-purple-400 text-sm mb-3">{member.role}</p>
                  <p className="text-gray-400 text-sm">{member.bio}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Why Choose ZORINO?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: 'Trusted Platform', description: 'Verified deals from reputable stores with secure transactions' },
              { icon: Zap, title: 'Real-Time Updates', description: 'Instant notifications when prices drop or new deals appear' },
              { icon: Globe, title: 'Global Coverage', description: 'Access deals from stores in 150+ countries worldwide' },
              { icon: Users, title: 'Community Driven', description: 'Reviews and ratings from real shoppers like you' },
              { icon: Award, title: 'Best Prices Guaranteed', description: 'Our AI ensures you always get the best available price' },
              { icon: Heart, title: 'User Privacy First', description: 'Your data is protected with enterprise-grade security' },
            ].map((feature, index) => (
              <Card key={index} hover>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400 text-sm">{feature.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-purple-600 to-blue-500 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Start Saving?</h2>
          <p className="text-white/80 mb-6 max-w-2xl mx-auto">
            Join millions of smart shoppers who trust ZORINO to find the best deals. Sign up today and start saving money on every purchase.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="bg-white text-purple-600 font-semibold px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors">
              Get Started Free
            </button>
            <button className="border-2 border-white text-white font-semibold px-8 py-3 rounded-lg hover:bg-white/10 transition-colors">
              Learn More
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
