'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Users, ShoppingBag, DollarSign, TrendingUp, Package, Store, AlertCircle, CheckCircle, Clock, BarChart3, Settings, LogOut } from 'lucide-react';

export default function AdminDashboardPage() {
  const t = useTranslations('admin');
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', icon: BarChart3, label: 'Overview' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'products', icon: Package, label: 'Products' },
    { id: 'deals', icon: ShoppingBag, label: 'Deals' },
    { id: 'stores', icon: Store, label: 'Stores' },
    { id: 'analytics', icon: TrendingUp, label: 'Analytics' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const stats = [
    { icon: Users, label: 'Total Users', value: '125,430', change: '+12%', positive: true },
    { icon: ShoppingBag, label: 'Active Deals', value: '8,542', change: '+8%', positive: true },
    { icon: DollarSign, label: 'Revenue', value: '$45,230', change: '+15%', positive: true },
    { icon: Package, label: 'Products', value: '52,890', change: '+5%', positive: true },
  ];

  const recentActivity = [
    { id: 1, type: 'user', message: 'New user registered: john.doe@email.com', time: '2 min ago', status: 'success' },
    { id: 2, type: 'deal', message: 'New deal added: iPhone 15 Pro Max', time: '15 min ago', status: 'success' },
    { id: 3, type: 'alert', message: 'Store API rate limit warning: Amazon', time: '1 hour ago', status: 'warning' },
    { id: 4, type: 'system', message: 'Database backup completed', time: '2 hours ago', status: 'success' },
    { id: 5, type: 'user', message: 'User reported issue with coupon code', time: '3 hours ago', status: 'error' },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">Welcome back, Admin</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <nav className="space-y-2">
                {tabs.map((tab) => (
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
                ))}
              </nav>

              <div className="mt-6 pt-6 border-t border-gray-800">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'overview' && (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {stats.map((stat, index) => (
                    <Card key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-10 h-10 ${stat.positive ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-lg flex items-center justify-center`}>
                          <stat.icon className={`w-5 h-5 ${stat.positive ? 'text-green-500' : 'text-red-500'}`} />
                        </div>
                        <span className={`text-sm ${stat.positive ? 'text-green-400' : 'text-red-400'}`}>
                          {stat.change}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
                      <div className="text-gray-400 text-sm">{stat.label}</div>
                    </Card>
                  ))}
                </div>

                {/* Recent Activity */}
                <Card className="mb-8">
                  <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-lg">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          activity.status === 'success' ? 'bg-green-500/20' :
                          activity.status === 'warning' ? 'bg-yellow-500/20' :
                          'bg-red-500/20'
                        }`}>
                          {activity.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                          {activity.status === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                          {activity.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-white">{activity.message}</p>
                          <p className="text-gray-400 text-sm">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card hover>
                    <div className="text-center">
                      <ShoppingBag className="w-8 h-8 text-purple-500 mx-auto mb-3" />
                      <h3 className="text-white font-semibold mb-1">Add New Deal</h3>
                      <p className="text-gray-400 text-sm mb-3">Create a new deal listing</p>
                      <Button variant="outline" size="sm" className="w-full">Add Deal</Button>
                    </div>
                  </Card>
                  <Card hover>
                    <div className="text-center">
                      <Package className="w-8 h-8 text-purple-500 mx-auto mb-3" />
                      <h3 className="text-white font-semibold mb-1">Add Product</h3>
                      <p className="text-gray-400 text-sm mb-3">Add a new product to catalog</p>
                      <Button variant="outline" size="sm" className="w-full">Add Product</Button>
                    </div>
                  </Card>
                  <Card hover>
                    <div className="text-center">
                      <Store className="w-8 h-8 text-purple-500 mx-auto mb-3" />
                      <h3 className="text-white font-semibold mb-1">Manage Stores</h3>
                      <p className="text-gray-400 text-sm mb-3">Configure store integrations</p>
                      <Button variant="outline" size="sm" className="w-full">Manage</Button>
                    </div>
                  </Card>
                </div>
              </>
            )}

            {activeTab === 'users' && (
              <Card>
                <h2 className="text-2xl font-bold text-white mb-6">User Management</h2>
                <div className="space-y-4">
                  {[
                    { name: 'John Doe', email: 'john@example.com', role: 'User', status: 'Active', joined: '2024-01-10' },
                    { name: 'Sarah Smith', email: 'sarah@example.com', role: 'Admin', status: 'Active', joined: '2024-01-05' },
                    { name: 'Mike Johnson', email: 'mike@example.com', role: 'User', status: 'Inactive', joined: '2024-01-03' },
                  ].map((user, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                          <span className="text-purple-400 font-semibold">{user.name[0]}</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-gray-400 text-sm">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-sm ${user.status === 'Active' ? 'text-green-400' : 'text-gray-400'}`}>
                          {user.status}
                        </span>
                        <span className="text-gray-400 text-sm">{user.role}</span>
                        <Button variant="outline" size="sm">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === 'products' && (
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Product Management</h2>
                  <Button>Add Product</Button>
                </div>
                <div className="space-y-4">
                  {[
                    { name: 'iPhone 15 Pro Max', category: 'Electronics', price: 999, status: 'Active' },
                    { name: 'MacBook Air M3', category: 'Electronics', price: 1099, status: 'Active' },
                    { name: 'Sony WH-1000XM5', category: 'Electronics', price: 299, status: 'Inactive' },
                  ].map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{product.name}</p>
                        <p className="text-gray-400 text-sm">{product.category} • ${product.price}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-sm ${product.status === 'Active' ? 'text-green-400' : 'text-gray-400'}`}>
                          {product.status}
                        </span>
                        <Button variant="outline" size="sm">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === 'deals' && (
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Deal Management</h2>
                  <Button>Add Deal</Button>
                </div>
                <div className="space-y-4">
                  {[
                    { name: 'iPhone 15 Pro Max 17% Off', discount: 17, endsIn: '2 days', status: 'Active' },
                    { name: 'MacBook Air M3 15% Off', discount: 15, endsIn: '5 days', status: 'Active' },
                    { name: 'Sony Headphones 25% Off', discount: 25, endsIn: '1 day', status: 'Expired' },
                  ].map((deal, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{deal.name}</p>
                        <p className="text-gray-400 text-sm">Ends in {deal.endsIn}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-sm ${deal.status === 'Active' ? 'text-green-400' : 'text-gray-400'}`}>
                          {deal.status}
                        </span>
                        <Button variant="outline" size="sm">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === 'stores' && (
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Store Integrations</h2>
                  <Button>Add Store</Button>
                </div>
                <div className="space-y-4">
                  {[
                    { name: 'Amazon', status: 'Connected', products: 15000, lastSync: '2 hours ago' },
                    { name: 'Alibaba', status: 'Connected', products: 8000, lastSync: '5 hours ago' },
                    { name: 'AliExpress', status: 'Disconnected', products: 0, lastSync: 'Never' },
                  ].map((store, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{store.name}</p>
                        <p className="text-gray-400 text-sm">{store.products} products • Last sync: {store.lastSync}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-sm ${store.status === 'Connected' ? 'text-green-400' : 'text-gray-400'}`}>
                          {store.status}
                        </span>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeTab === 'analytics' && (
              <Card>
                <h2 className="text-2xl font-bold text-white mb-6">Analytics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-gray-800/50 rounded-lg">
                    <h3 className="text-white font-semibold mb-4">Traffic Overview</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Page Views</span>
                        <span className="text-white">125,430</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Unique Visitors</span>
                        <span className="text-white">45,230</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Bounce Rate</span>
                        <span className="text-white">32%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Avg Session</span>
                        <span className="text-white">4m 32s</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-800/50 rounded-lg">
                    <h3 className="text-white font-semibold mb-4">Conversion</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Click-through Rate</span>
                        <span className="text-white">12.5%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Conversion Rate</span>
                        <span className="text-white">3.2%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Revenue</span>
                        <span className="text-white">$45,230</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Avg Order Value</span>
                        <span className="text-white">$89.50</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'settings' && (
              <Card>
                <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">General Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="text-white font-medium">Maintenance Mode</p>
                          <p className="text-gray-400 text-sm">Temporarily disable the site</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500" />
                        </label>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="text-white font-medium">Debug Mode</p>
                          <p className="text-gray-400 text-sm">Enable detailed error logging</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full">Save Settings</Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
