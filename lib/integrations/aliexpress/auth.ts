import { createHash } from "node:crypto";

/** MD5 sign for AliExpress Open Platform requests. */
export function signAliExpressParams(
  params: Record<string, string>,
  appSecret: string
): string {
  const sorted = Object.keys(params).sort();
  let base = appSecret;
  for (const key of sorted) base += key + params[key];
  base += appSecret;
  return createHash("md5").update(base).digest("hex").toUpperCase();
}

export function buildSignedParams(
  method: string,
  appKey: string,
  appSecret: string,
  bizParams: Record<string, string>
): Record<string, string> {
  const params: Record<string, string> = {
    method,
    app_key: appKey,
    sign_method: "md5",
    timestamp: Date.now().toString(),
    format: "json",
    v: "2.0",
    ...bizParams,
  };
  params.sign = signAliExpressParams(params, appSecret);
  return params;
}
