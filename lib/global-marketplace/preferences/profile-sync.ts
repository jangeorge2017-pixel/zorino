import type { Locale } from "@/i18n/config";
import type { CountryCode, CurrencyCode } from "@/lib/international/config";
import { getCurrentUser, updateUserProfile } from "@/services/users";

export type ProfileIntlSyncInput = {
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  locale?: Locale;
};

/**
 * Persist intl preferences to authenticated user profile.
 * Non-blocking — returns silently when user is not signed in.
 */
export async function syncIntlPreferencesToProfile(
  prefs: ProfileIntlSyncInput
): Promise<{ synced: boolean; error?: string }> {
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) {
    return { synced: false };
  }

  const { error } = await updateUserProfile(user.id, {
    countryCode: prefs.countryCode,
    currency: prefs.currencyCode,
    locale: prefs.locale,
  });

  if (error) {
    return { synced: false, error };
  }

  return { synced: true };
}

/**
 * Build preferences from profile when cookies are absent (post-login hydration).
 */
export function profileToIntlPreferences(user: {
  countryCode?: string | null;
  currency?: string | null;
  locale?: string | null;
}): Partial<ProfileIntlSyncInput> {
  return {
    countryCode: user.countryCode as CountryCode | undefined,
    currencyCode: user.currency as CurrencyCode | undefined,
    locale: (user.locale as Locale | undefined) ?? undefined,
  };
}
