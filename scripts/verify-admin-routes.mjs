/**
 * Verify admin routes respond correctly.
 * Usage: node scripts/verify-admin-routes.mjs [baseUrl]
 */
const baseUrl = process.argv[2] ?? "http://localhost:3000";

async function check(path, { expectRedirect = false } = {}) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const ok = expectRedirect
    ? res.status >= 300 && res.status < 400 && location.includes("login")
    : res.status >= 200 && res.status < 400;

  return {
    path,
    status: res.status,
    location,
    ok,
  };
}

const login = await check("/admin/login");
const admin = await check("/admin", { expectRedirect: true });

console.log(JSON.stringify({ baseUrl, login, admin, allOk: login.ok && admin.ok }, null, 2));
process.exit(login.ok && admin.ok ? 0 : 1);
