# ZORINO - Smart Deal Discovery Platform

ZORINO is an AI-powered deal discovery and price comparison platform that helps users find the best prices across multiple marketplaces including Amazon, Alibaba, AliExpress, Noon, Temu, and more.

## Features

- **Multi-Language Support**: Full English and Arabic support with RTL/LTR layout switching
- **Deal Discovery**: Browse and search deals across multiple marketplaces
- **Price Comparison**: Compare prices from different stores
- **Coupon Codes**: Access exclusive discount codes
- **Product Alerts**: Set price alerts for wishlist items
- **Wishlist**: Save products for later
- **Product Comparison**: Compare up to 4 products side-by-side
- **Blog**: Shopping guides, tips, and reviews
- **User Profile**: Manage account settings and preferences
- **Admin Dashboard**: Comprehensive admin panel for platform management
- **Affiliate System**: Track clicks and commissions
- **SEO Optimized**: Built-in SEO with sitemaps and meta tags
- **Performance Optimized**: Lazy loading, caching, and optimization utilities
- **Security**: Input validation, XSS prevention, CSRF protection, rate limiting

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Internationalization**: next-intl
- **Icons**: Lucide React
- **State Management**: React Context API
- **Authentication**: Custom auth system with social login support

## Project Structure

```
zorino/
├── app/
│   ├── [locale]/          # Localized routes (en, ar)
│   │   ├── auth/          # Authentication pages
│   │   ├── deals/         # Deals page
│   │   ├── coupons/       # Coupons page
│   │   ├── categories/    # Categories page
│   │   ├── stores/        # Stores page
│   │   ├── search/        # Search page
│   │   ├── product/       # Product details page
│   │   ├── compare/       # Product comparison page
│   │   ├── blog/          # Blog page
│   │   ├── about/         # About page
│   │   ├── contact/       # Contact page
│   │   ├── privacy/       # Privacy policy page
│   │   ├── terms/         # Terms and conditions page
│   │   ├── faq/           # FAQ page
│   │   ├── profile/       # User profile page
│   │   ├── wishlist/      # Wishlist page
│   │   ├── notifications/  # Notifications page
│   │   └── admin/         # Admin dashboard
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   └── Modal.tsx
│   ├── Hero.tsx           # Hero section
│   ├── navbar.tsx         # Navigation bar
│   ├── SearchBar.tsx      # Search bar component
│   └── LanguageSwitcher.tsx
├── lib/
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   ├── auth/              # Authentication context
│   ├── i18n/              # Internationalization config
│   ├── integrations/      # Marketplace integrations
│   ├── affiliate/         # Affiliate system
│   ├── seo/               # SEO utilities
│   ├── performance/       # Performance optimization
│   ├── security/          # Security utilities
│   └── database/          # Database schema
├── messages/
│   ├── en.json            # English translations
│   └── ar.json            # Arabic translations
├── public/
│   ├── reference/zorino-final-design.png  # Background source of truth
│   ├── backgrounds/zorino-homepage-bg.png # Extracted atmosphere (from reference)
│   ├── backgrounds/zorino-homepage-bg@2x.png
│   ├── hero-z-logo.svg     # 1:1 SVG wrapper over hero-z-logo.png
│   ├── hero-z.png          # Hero scene only (3D Z + platform, 1254×1254)
│   ├── logo/               # Retina PNG variants (@2x–@4x) from hero-z-logo.png
│   ├── robots.txt
│   └── reference/          # Design reference only — never used in UI
│       └── zorino-final-design.png
├── middleware.ts          # Next.js middleware for i18n
├── next.config.ts         # Next.js configuration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

```bash
# Install dependencies
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### Development

```bash
# Run development server
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Build

```bash
# Create production build
npm run build
# or
yarn build
# or
pnpm build
# or
bun build
```

### Start Production Server

```bash
npm start
# or
yarn start
# or
pnpm start
# or
bun start
```

## Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/zorino

# NextAuth
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# Marketplace API Keys
AMAZON_ACCESS_KEY_ID=your-key
AMAZON_SECRET_ACCESS_KEY=your-secret
ALIBABA_API_KEY=your-key
ALIEXPRESS_API_KEY=your-key
NOON_API_KEY=your-key
TEMU_API_KEY=your-key

# Email Service (for notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASSWORD=your-password

# Redis (for caching)
REDIS_URL=redis://localhost:6379
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot-password` - Request password reset

### Product Endpoints

- `GET /api/products` - List products with filters
- `GET /api/products/:id` - Get product details
- `GET /api/products/:id/price-history` - Get price history

### Deal Endpoints

- `GET /api/deals` - List deals with filters
- `GET /api/deals/:id` - Get deal details

### Coupon Endpoints

- `GET /api/coupons` - List coupons with filters
- `GET /api/coupons/:id` - Get coupon details

### User Endpoints

- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/wishlist` - Get user wishlist
- `POST /api/user/wishlist` - Add to wishlist
- `DELETE /api/user/wishlist/:id` - Remove from wishlist

### Affiliate Endpoints

- `POST /api/affiliate/generate-link` - Generate affiliate link
- `GET /api/affiliate/stats` - Get affiliate statistics
- `GET /api/affiliate/commissions` - Get commissions

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Docker

```bash
# Build Docker image
docker build -t zorino .

# Run container
docker run -p 3000:3000 zorino
```

### Manual Deployment

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## Database Setup

The project uses PostgreSQL. Run migrations to set up the database schema:

```bash
# Run all migrations
npm run migrate

# Run specific migration
npm run migrate:up 001

# Rollback migration
npm run migrate:down 001
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, email support@zorino.com or open an issue on GitHub.
