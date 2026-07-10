"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages, IntlError } from "next-intl";
import type { ReactNode } from "react";

type IntlClientProviderProps = {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
};

function handleIntlError(error: IntlError) {
  if (error.code === "MISSING_MESSAGE") return;
  console.error(error);
}

function getMessageFallback({
  namespace,
  key,
}: {
  namespace?: string;
  key: string;
}) {
  return namespace ? `${namespace}.${key}` : key;
}

/**
 * Client-only wrapper so intl callbacks never cross the Server → Client boundary.
 */
export default function IntlClientProvider({
  locale,
  messages,
  children,
}: IntlClientProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="UTC"
      onError={handleIntlError}
      getMessageFallback={getMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
