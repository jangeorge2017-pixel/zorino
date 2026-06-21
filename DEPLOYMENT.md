# ZORINO Deployment Guide

This guide provides detailed instructions for deploying the ZORINO platform to various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Deployment Options](#deployment-options)
  - [Vercel Deployment](#vercel-deployment)
  - [Docker Deployment](#docker-deployment)
  - [Manual Deployment](#manual-deployment)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying ZORINO, ensure you have:

- Node.js 18 or higher
- npm, yarn, pnpm, or bun
- PostgreSQL 15 or higher (for production)
- Redis 7 or higher (for caching, optional)
- Docker and Docker Compose (for Docker deployment)
- Git (for version control)
- Domain name (for production)
- SSL certificate (for production HTTPS)

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/zorino.git
cd zorino
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Configure Environment Variables

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

## Deployment Options

### Vercel Deployment (Recommended)

Vercel is the recommended deployment platform for Next.js applications.

#### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

#### Step 2: Import Project in Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure environment variables in Vercel dashboard
5. Click "Deploy"

#### Step 3: Configure Environment Variables

Add the following environment variables in Vercel:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `AMAZON_ACCESS_KEY_ID`
- `AMAZON_SECRET_ACCESS_KEY`
- `ALIBABA_API_KEY`
- `ALIEXPRESS_API_KEY`
- `NOON_API_KEY`
- `TEMU_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `REDIS_URL`

#### Step 4: Configure Custom Domain (Optional)

1. Go to project settings in Vercel
2. Click "Domains"
3. Add your custom domain
4. Configure DNS records as instructed
5. Vercel will automatically provision SSL certificates

### Docker Deployment

Docker deployment provides a consistent environment across development and production.

#### Step 1: Build Docker Image

```bash
docker build -t zorino .
```

#### Step 2: Run with Docker Compose

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database
- Redis cache
- Next.js application
- Nginx reverse proxy (optional)

#### Step 3: Configure Environment Variables

Edit the `docker-compose.yml` file or create a `.env` file with your environment variables.

#### Step 4: Access the Application

The application will be available at `http://localhost:3000`

### Manual Deployment

For manual deployment to your own server.

#### Step 1: Build the Application

```bash
npm run build
```

#### Step 2: Start the Production Server

```bash
npm start
```

The application will run on port 3000 by default.

#### Step 3: Configure Reverse Proxy (Optional)

Use Nginx or Apache as a reverse proxy:

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Step 4: Configure SSL with Let's Encrypt

```bash
sudo certbot --nginx -d your-domain.com
```

## Database Setup

### PostgreSQL Setup

#### Option 1: Local PostgreSQL

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb zorino

# Create user
sudo -u postgres createuser zorino_user

# Grant privileges
sudo -u postgres psql
ALTER USER zorino_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE zorino TO zorino_user;
```

#### Option 2: Managed PostgreSQL (Recommended for Production)

Use a managed service like:
- AWS RDS
- Google Cloud SQL
- Azure Database for PostgreSQL
- Supabase
- Neon

### Run Database Migrations

```bash
# Run all migrations
npm run migrate

# Run specific migration
npm run migrate:up 001

# Rollback migration
npm run migrate:down 001
```

### Seed Database (Optional)

```bash
npm run seed
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | Secret key for NextAuth | `random-secret-key` |
| `NEXTAUTH_URL` | Application URL | `https://zorino.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | - |
| `SMTP_HOST` | SMTP server host | - |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASSWORD` | SMTP password | - |
| `AMAZON_ACCESS_KEY_ID` | Amazon API key | - |
| `AMAZON_SECRET_ACCESS_KEY` | Amazon API secret | - |
| `ALIBABA_API_KEY` | Alibaba API key | - |
| `ALIEXPRESS_API_KEY` | AliExpress API key | - |
| `NOON_API_KEY` | Noon API key | - |
| `TEMU_API_KEY` | Temu API key | - |

## Post-Deployment Configuration

### 1. Configure Marketplace API Keys

Sign up for affiliate programs and obtain API keys:

- **Amazon Associates**: [https://affiliate-program.amazon.com](https://affiliate-program.amazon.com)
- **AliExpress Affiliate**: [https://portals.aliexpress.com](https://portals.aliexpress.com)
- **Alibaba Affiliate**: [https://campaign.alibaba.com](https://campaign.alibaba.com)
- **Noon Affiliate**: [https://affiliate.noon.com](https://affiliate.noon.com)
- **Temu Affiliate**: [https://kuikbuy.com](https://kuikbuy.com)

### 2. Configure Email Service

Set up an SMTP service for email notifications:

- **SendGrid**: [https://sendgrid.com](https://sendgrid.com)
- **Mailgun**: [https://mailgun.com](https://mailgun.com)
- **AWS SES**: [https://aws.amazon.com/ses](https://aws.amazon.com/ses)
- **Postmark**: [https://postmarkapp.com](https://postmarkapp.com)

### 3. Configure CDN (Optional)

For better performance, configure a CDN:

- **Cloudflare**: [https://cloudflare.com](https://cloudflare.com)
- **AWS CloudFront**: [https://aws.amazon.com/cloudfront](https://aws.amazon.com/cloudfront)
- **Fastly**: [https://www.fastly.com](https://www.fastly.com)

### 4. Configure Monitoring

Set up monitoring and alerting:

- **Sentry**: [https://sentry.io](https://sentry.io) - Error tracking
- **Vercel Analytics**: Built-in analytics for Vercel deployments
- **Google Analytics**: Web analytics
- **New Relic**: APM and monitoring

## Monitoring and Maintenance

### Health Checks

Monitor the application health:

```bash
# Check if application is running
curl https://your-domain.com/api/health

# Check database connection
# (Implement a health check endpoint)
```

### Log Monitoring

Monitor application logs:

- **Vercel**: Built-in log viewer
- **Docker**: `docker logs zorino-app`
- **Manual**: Check server logs

### Backup Strategy

Implement regular backups:

- **Database**: Daily automated backups
- **Files**: Weekly backups of static assets
- **Configuration**: Version control for configuration files

### Updates

Keep the application updated:

```bash
# Update dependencies
npm update

# Rebuild and redeploy
npm run build
npm start
```

## Troubleshooting

### Common Issues

#### 1. Build Errors

**Problem**: Build fails with errors

**Solution**:
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules
rm -rf node_modules
npm install

# Rebuild
npm run build
```

#### 2. Database Connection Issues

**Problem**: Cannot connect to database

**Solution**:
- Verify `DATABASE_URL` is correct
- Check database is running
- Ensure firewall allows connection
- Verify database credentials

#### 3. Environment Variables Not Loading

**Problem**: Environment variables not working

**Solution**:
- Verify `.env.local` file exists
- Restart the application after changing variables
- Check variable names match exactly
- For Vercel, verify variables are set in dashboard

#### 4. Port Already in Use

**Problem**: Port 3000 is already in use

**Solution**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm start
```

#### 5. Memory Issues

**Problem**: Application runs out of memory

**Solution**:
- Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096" npm start`
- Optimize images and assets
- Implement caching
- Use a CDN for static assets

### Getting Help

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/your-username/zorino/issues)
2. Review the [Documentation](README.md)
3. Contact support at support@zorino.com

## Security Best Practices

1. **Use HTTPS**: Always use HTTPS in production
2. **Environment Variables**: Never commit `.env.local` to version control
3. **Database Security**: Use strong passwords and restrict access
4. **API Keys**: Rotate API keys regularly
5. **Dependencies**: Keep dependencies updated
6. **Rate Limiting**: Implement rate limiting on API endpoints
7. **Input Validation**: Validate all user inputs
8. **CSRF Protection**: Use CSRF tokens for forms
9. **Security Headers**: Configure security headers
10. **Regular Audits**: Perform regular security audits

## Performance Optimization

1. **Enable Caching**: Use Redis for caching
2. **CDN**: Use a CDN for static assets
3. **Image Optimization**: Optimize images before upload
4. **Code Splitting**: Implement code splitting
5. **Lazy Loading**: Use lazy loading for images and components
6. **Database Indexing**: Add indexes to frequently queried fields
7. **Minimize Bundle Size**: Analyze and minimize bundle size
8. **Server-Side Rendering**: Use SSR for better SEO

## Scaling

### Horizontal Scaling

- Use load balancers (Nginx, AWS ELB)
- Deploy multiple instances
- Use auto-scaling groups (AWS, GCP)
- Implement session storage in Redis

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Optimize database queries
- Use read replicas for database
- Implement connection pooling

## CI/CD Pipeline

The project includes a GitHub Actions workflow for CI/CD:

- **Lint**: Runs ESLint on every push
- **Test**: Runs tests on every push
- **Build**: Builds the application
- **Docker**: Builds and pushes Docker images
- **Deploy**: Deploys to production on main branch

See `.github/workflows/ci-cd.yml` for configuration.

## Rollback Procedure

If deployment fails:

### Vercel Rollback

1. Go to Vercel dashboard
2. Select your project
3. Go to "Deployments"
4. Click on the previous successful deployment
5. Click "Rollback"

### Docker Rollback

```bash
# Stop current container
docker-compose down

# Pull previous image
docker pull your-username/zorino:previous-tag

# Start with previous image
docker-compose up -d
```

### Manual Rollback

```bash
# Revert to previous commit
git checkout <previous-commit-hash>

# Rebuild
npm run build

# Restart
npm start
```

## Support

For deployment support:
- Email: support@zorino.com
- GitHub Issues: [https://github.com/your-username/zorino/issues](https://github.com/your-username/zorino/issues)
- Documentation: [README.md](README.md)
