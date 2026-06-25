# Zorino Supabase migrations

Apply in order via Supabase SQL Editor or CLI (`npm run db:push`).

| File | Contents |
|------|----------|
| `001_zorino_foundation.sql` | Core schema: currencies, countries, users (profiles + `users` view), categories, stores, products, prices, deals, coupons, favorites, notifications, RLS |
| `002_sync_architecture.sql` | Product sync: images, external mappings, sync jobs |
| `003_admin_rls_storage.sql` | Admin write policies + `catalog-images` storage bucket |
| `seed.sql` | Sample stores, products, deals, coupons |

## Required tables (001)

- **users** — `profiles` table + `users` view (linked to Supabase Auth)
- **products**, **stores**, **categories**, **prices**, **deals**, **coupons**
- **favorites**, **notifications**
- **countries**, **currencies**

## Environment

Copy `.env.example` to `.env.local` and set:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Until credentials are added, the app uses mock data from `data/home.ts`.

## Admin dashboard

1. Apply `003_admin_rls_storage.sql` (via `db:push` or SQL editor).
2. Seed catalog data: `npm run db:seed`
3. Create an admin user:

```bash
npm run admin:create -- admin@zorino.com YourSecurePassword123
```

4. Sign in at `/admin/login` and manage catalog at `/admin`.

Admin routes require `profiles.is_admin = true`. Image uploads go to the public `catalog-images` Supabase Storage bucket.
