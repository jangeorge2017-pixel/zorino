'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { User, Settings, Heart, Bell, Shield, CreditCard, LogOut, Camera, Edit3, CheckCircle } from 'lucide-react';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const tabs = [
    { id: 'profile', icon: User, label: 'Edit Profile' },
    { id: 'settings', icon: Settings, label: 'Account Settings' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'security', icon: Shield, label: 'Security' },
  ];

  const handleSave = async () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Please log in</h2>
          <Button onClick={() => router.push('/auth/login')}>Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                  <span className="text-4xl">👤</span>
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>
                <h3 className="text-xl font-semibold text-white">{user.name}</h3>
                <p className="text-gray-400 text-sm">{user.email}</p>
                {user.isVerified && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Verified
                  </div>
                )}
              </div>

              <nav className="space-y-2">
                {tabs.map((tab) => (
                  tab.id === 'settings' ? (
                    <Link
                      key={tab.id}
                      href="/settings"
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-400 hover:bg-gray-800/50 hover:text-white"
                    >
                      <tab.icon className="w-5 h-5" />
                      {tab.label}
                    </Link>
                  ) : (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                  )
                ))}
              </nav>

              <div className="mt-6 pt-6 border-t border-gray-800">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  {t('logout')}
                </button>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'profile' && (
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">{t('editProfile')}</h2>
                  <Button
                    variant={isEditing ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? <Edit3 className="w-4 h-4 mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
                    {isEditing ? 'Cancel' : 'Edit'}
                  </Button>
                </div>

                {saveSuccess && (
                  <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-6">
                    {t('profileUpdated')}
                  </div>
                )}

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Full Name"
                      defaultValue={user.name}
                      disabled={!isEditing}
                    />
                    <Input
                      label="Email Address"
                      defaultValue={user.email}
                      disabled={!isEditing}
                    />
                  </div>

                  <Input
                    label="Phone Number"
                    placeholder="+1 (555) 123-4567"
                    disabled={!isEditing}
                  />

                  <Select
                    label="Country"
                    options={[
                      { value: '', label: 'Select Country' },
                      { value: 'us', label: 'United States' },
                      { value: 'ae', label: 'United Arab Emirates' },
                      { value: 'sa', label: 'Saudi Arabia' },
                      { value: 'eg', label: 'Egypt' },
                    ]}
                    disabled={!isEditing}
                  />

                  {isEditing && (
                    <div className="flex gap-4">
                      <Button onClick={handleSave} className="flex-1">
                        {t('save')}
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {activeTab === 'settings' && (
              <Card>
                <h2 className="text-2xl font-bold text-white mb-6">{t('accountSettings')}</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Preferences</h3>
                    <div className="space-y-4">
                      <Select
                        label="Language"
                        options={[
                          { value: 'en', label: 'English' },
                          { value: 'ar', label: 'Arabic' },
                        ]}
                        defaultValue="en"
                      />
                      <Select
                        label="Currency"
                        options={[
                          { value: 'usd', label: 'USD ($)' },
                          { value: 'aed', label: 'AED (د.إ)' },
                          { value: 'sar', label: 'SAR (ر.س)' },
                          { value: 'egp', label: 'EGP (ج.م)' },
                        ]}
                        defaultValue="usd"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Connected Accounts</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-xl">G</span>
                          </div>
                          <div>
                            <p className="text-white font-medium">Google</p>
                            <p className="text-gray-400 text-sm">Connected</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Disconnect</Button>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                            <span className="text-xl">f</span>
                          </div>
                          <div>
                            <p className="text-white font-medium">Facebook</p>
                            <p className="text-gray-400 text-sm">Not connected</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Connect</Button>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full">{t('save')}</Button>
                </div>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card>
                <h2 className="text-2xl font-bold text-white mb-6">{t('notificationSettings')}</h2>

                <div className="space-y-6">
                  <div className="space-y-4">
                    {[
                      { label: 'Price drop alerts', description: 'Get notified when prices drop on your wishlist items' },
                      { label: 'New deals', description: 'Receive notifications about new deals in your favorite categories' },
                      { label: 'Coupon codes', description: 'Get alerts when new coupon codes are available' },
                      { label: 'Newsletter', description: 'Weekly digest of the best deals and shopping tips' },
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="text-white font-medium">{item.label}</p>
                          <p className="text-gray-400 text-sm">{item.description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked={index < 3} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500" />
                        </label>
                      </div>
                    ))}
                  </div>

                  <Button className="w-full">{t('save')}</Button>
                </div>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card>
                <h2 className="text-2xl font-bold text-white mb-6">{t('security')}</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
                    <div className="space-y-4">
                      <Input
                        label="Current Password"
                        type="password"
                        placeholder="•••••••••"
                      />
                      <Input
                        label="New Password"
                        type="password"
                        placeholder="•••••••••"
                      />
                      <Input
                        label="Confirm New Password"
                        type="password"
                        placeholder="•••••••••"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Two-Factor Authentication</h3>
                    <div className="p-4 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">2FA is not enabled</p>
                          <p className="text-gray-400 text-sm">Add an extra layer of security to your account</p>
                        </div>
                        <Button variant="outline" size="sm">Enable</Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 text-red-400">Danger Zone</h3>
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">Delete Account</p>
                          <p className="text-gray-400 text-sm">Permanently delete your account and all data</p>
                        </div>
                        <Button variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/10">
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full">{t('save')}</Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
