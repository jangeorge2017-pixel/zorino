"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { PageHeader, PageLayout } from "@/components/pages";
import { Bell, CheckCircle, Globe, Moon, Shield } from "lucide-react";

export default function SettingsPageClient() {
  const t = useTranslations("profile");
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    locale: "en",
    currency: "USD",
    country: "US",
    emailNotifications: true,
    priceAlerts: true,
    dealDigest: false,
    theme: "dark",
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="zor-page-state zor-page-state--empty">
          <h2 className="zor-page-state__title">Please log in</h2>
          <p className="zor-page-state__text">Sign in to manage your account settings.</p>
          <Button onClick={() => router.push("/auth/login")} className="mt-4">Login</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Settings"
        subtitle="Manage your preferences, notifications, and account security"
        actions={
          <Button variant="outline" onClick={() => router.push("/profile")}>
            Back to Profile
          </Button>
        }
      />

      {saved ? (
        <Card className="mb-6 border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            Settings saved successfully
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Regional Preferences</h2>
          </div>
          <div className="space-y-4">
            <Select
              label="Language"
              options={[
                { value: "en", label: "English" },
                { value: "ar", label: "العربية" },
              ]}
              value={settings.locale}
              onChange={(e) => setSettings({ ...settings, locale: e.target.value })}
            />
            <Select
              label="Currency"
              options={[
                { value: "USD", label: "USD ($)" },
                { value: "EUR", label: "EUR (€)" },
                { value: "AED", label: "AED (د.إ)" },
              ]}
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
            />
            <Select
              label="Country"
              options={[
                { value: "US", label: "United States" },
                { value: "AE", label: "United Arab Emirates" },
                { value: "UK", label: "United Kingdom" },
              ]}
              value={settings.country}
              onChange={(e) => setSettings({ ...settings, country: e.target.value })}
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Notifications</h2>
          </div>
          <div className="space-y-4">
            {[
              { key: "emailNotifications" as const, label: "Email notifications" },
              { key: "priceAlerts" as const, label: "Price drop alerts" },
              { key: "dealDigest" as const, label: "Weekly deal digest" },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="text-gray-300">{item.label}</span>
                <input
                  type="checkbox"
                  checked={settings[item.key]}
                  onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-600"
                />
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-6">
            <Moon className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Appearance</h2>
          </div>
          <Select
            label="Theme"
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ]}
            value={settings.theme}
            onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
          />
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Security</h2>
          </div>
          <div className="space-y-4">
            <Input label="Current Password" type="password" placeholder="••••••••" />
            <Input label="New Password" type="password" placeholder="••••••••" />
            <Input label="Confirm Password" type="password" placeholder="••••••••" />
          </div>
        </Card>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleSave}>{t("save")}</Button>
      </div>
    </PageLayout>
  );
}
