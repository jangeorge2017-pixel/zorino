import { createHash } from "node:crypto";
import { logAliExpress, maskSecret } from "@/lib/integrations/aliexpress/logger";

/**
 * AliExpress / TOP signature (MD5):
 * 1. Sort all request parameters alphabetically by key (exclude `sign`)
 * 2. Concatenate: appSecret + key1 + value1 + key2 + value2 + … + appSecret
 * 3. MD5 hex, uppercase
 *
 * @see https://developer.alibaba.com/docs/doc.htm?articleId=108974
 */
export function signAliExpressParams(
  params: Record<string, string>,
  appSecret: string
): string {
  const sorted = Object.keys(params)
    .filter((key) => key !== "sign" && params[key] !== undefined && params[key] !== "")
    .sort();

  let base = appSecret;
  for (const key of sorted) {
    base += key + params[key];
  }
  base += appSecret;

  const sign = createHash("md5").update(base, "utf8").digest("hex").toUpperCase();

  logAliExpress("signature computed", {
    algorithm: "md5",
    encoding: "utf8",
    paramKeysSorted: sorted,
    signLength: sign.length,
    appSecretLoaded: Boolean(appSecret?.trim()),
    // Length of the bookend string without revealing the secret values.
    baseLengthWithoutSecrets: base.length - appSecret.length * 2,
  });

  return sign;
}

/** AliExpress requires timestamp as yyyy-MM-dd HH:mm:ss in GMT+8 (Asia/Shanghai). */
export function formatAliExpressTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  // en-CA yields YYYY-MM-DD; hour may be "24" at midnight in some engines — normalize.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}

export function buildSignedParams(
  method: string,
  appKey: string,
  appSecret: string,
  bizParams: Record<string, string>
): Record<string, string> {
  const timestamp = formatAliExpressTimestamp();

  logAliExpress("building signed params", {
    method,
    appKeyMasked: maskSecret(appKey),
    appSecretLoaded: Boolean(appSecret?.trim()),
    appSecretMasked: maskSecret(appSecret),
    timestamp,
    timestampFormat: "yyyy-MM-dd HH:mm:ss (Asia/Shanghai / GMT+8)",
    bizParamKeys: Object.keys(bizParams),
  });

  if (!appKey?.trim() || !appSecret?.trim()) {
    logAliExpress("AUTHENTICATION ERROR: missing app_key or app_secret", {
      hasAppKey: Boolean(appKey?.trim()),
      hasAppSecret: Boolean(appSecret?.trim()),
    });
    throw new Error(
      "AliExpress authentication failed: ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET must be set"
    );
  }

  const params: Record<string, string> = {
    method,
    app_key: appKey,
    sign_method: "md5",
    timestamp,
    format: "json",
    v: "2.0",
    ...bizParams,
  };

  params.sign = signAliExpressParams(params, appSecret);
  return params;
}
