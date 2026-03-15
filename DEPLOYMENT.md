# Elite 24 Finds Enhanced - Deployment & GitHub Guide

## 🚀 Quick Start

This is a high-performance e-commerce platform built with React, Express, tRPC, and MySQL. It features AI-powered product image generation, advanced analytics, and a hidden admin dashboard.

## 📋 Prerequisites

- Node.js 22+
- pnpm package manager
- MySQL database
- Manus OAuth credentials (automatically provided)

## 🔧 Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables (auto-configured in Manus)
# DATABASE_URL, JWT_SECRET, OAUTH credentials are pre-configured

# Generate database migrations
pnpm drizzle-kit generate

# Apply migrations (via Manus UI or manual SQL)
# See drizzle/*.sql files

# Start development server
pnpm dev
```

## 📁 Project Structure

```
client/
  src/
    pages/
      Home.tsx          - Public home page with products
      Dashboard.tsx     - Hidden admin dashboard (/admin or /dashboard)
    components/        - Reusable UI components
    lib/trpc.ts       - tRPC client setup
    index.css         - Clickbait color scheme (neon accents)

server/
  routers.ts          - tRPC procedures for products, analytics, admin
  db.ts               - Database query helpers
  integrations/
    llm.ts            - AI content generation (descriptions, tags, captions)
    amazon.ts         - Amazon affiliate link generation
  sitemapRouter.ts    - Dynamic sitemap.xml generation

drizzle/
  schema.ts           - Database tables (products, analytics, images, logs)
  *.sql               - Migration files
```

## 🔐 Admin Access

**Hidden Admin Dashboard:**
- Route: `/admin` or `/dashboard`
- Access: Only visible to users with `role: 'admin'`
- Authentication: Manus OAuth (automatic)
- Features:
  - Product management (add, edit, delete, bulk operations)
  - AI image generation (8K clickbait-style images)
  - Analytics dashboard (clicks, conversions, top products)
  - Admin activity logs
  - Bulk image generation controls

**To promote a user to admin:**
1. Login to Manus dashboard
2. Access the Database panel
3. Update the `users` table, set `role = 'admin'` for desired user

## 🎨 Design Features

- **Clickbait Color Scheme**: Neon purple, red, and green accents with bold gradients
- **Responsive Design**: Mobile-first, optimized for all devices
- **Traffic-Boosting Features**:
  - Trending products section
  - Email capture with incentives
  - Social sharing buttons
  - Category filtering
  - Advanced search
  - Product ratings and reviews

## 🤖 AI Features

### Image Generation
- Generates 8K clickbait-style product images
- Bulk generation from admin dashboard
- Automatic S3 storage with CDN delivery
- Customizable styles and prompts

### Content Generation
- Product descriptions (SEO-optimized)
- Pinterest captions (engagement-focused)
- Product tags and keywords
- Deal analysis and worthiness scoring

## 📊 Analytics & Tracking

- Click tracking on all products
- Conversion tracking
- Top-performing products dashboard
- Session-based analytics
- Admin activity logging

## 🌐 SEO Enhancements

- Dynamic meta tags (title, description, keywords)
- Open Graph tags for social sharing
- Twitter Card tags
- Structured data (JSON-LD)
- Dynamic sitemap.xml generation
- robots.txt configuration
- Canonical URLs
- Mobile-friendly design

## 🚀 Deployment to GitHub

### 1. Create GitHub Repository

```bash
# Initialize git (if not already done)
git init
git config user.email "your-email@example.com"
git config user.name "Your Name"

# Add all files
git add -A
git commit -m "Initial commit: Elite 24 Finds Enhanced"

# Create repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/elite-24-finds-enhanced.git
git branch -M main
git push -u origin main
```

### 2. Push to GitHub via Manus UI

1. Open the **Settings** panel in Manus Management UI
2. Navigate to **GitHub** section
3. Select your GitHub account
4. Enter repository name: `elite-24-finds-enhanced`
5. Click **Export to GitHub**
6. Manus will automatically push all code

### 3. GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm check
      - run: pnpm test
      - run: pnpm build
```

## 📦 Building for Production

```bash
# Build frontend and backend
pnpm build

# Output:
# - dist/index.js (server)
# - dist/client (frontend assets)

# Start production server
pnpm start
```

## 🔑 Environment Variables

All environment variables are automatically configured in Manus:

- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - Session signing secret
- `VITE_APP_ID` - Manus OAuth app ID
- `OAUTH_SERVER_URL` - OAuth provider URL
- `OWNER_OPEN_ID` - Admin user's OpenID
- `BUILT_IN_FORGE_API_KEY` - LLM and image generation API key
- `BUILT_IN_FORGE_API_URL` - API endpoint for LLM and images

## 📱 Mobile Optimization

- Touch-friendly buttons and interactions
- Responsive grid layouts
- Mobile-optimized navigation
- Fast loading with lazy image loading
- Optimized for all screen sizes (320px - 4K)

## 🎯 Traffic-Boosting Features

1. **Trending Products**: Automatically featured based on clicks
2. **Email Capture**: Newsletter signup with incentives
3. **Social Sharing**: Share deals on social media
4. **Category Filtering**: Easy product discovery
5. **Search**: Real-time product search
6. **Urgency Messaging**: "Limited time" and discount badges
7. **Social Proof**: "50K+ deal hunters" statistics
8. **Product Ratings**: Star ratings and review counts

## 🔧 Customization

### Change Colors
Edit `client/src/index.css`:
```css
:root {
  --primary: oklch(0.65 0.28 280); /* Change primary color */
  --secondary: oklch(0.7 0.25 20); /* Change secondary color */
}
```

### Add New Categories
Edit `client/src/pages/Home.tsx`:
```tsx
const categories = [
  "Electronics",
  "Home & Kitchen",
  // Add your categories here
];
```

### Customize Admin Dashboard
Edit `client/src/pages/Dashboard.tsx` to add new tabs, analytics, or features.

## 🐛 Troubleshooting

**Module not found errors**: Run `pnpm install` and restart dev server
**Database connection issues**: Check `DATABASE_URL` in Manus settings
**Image generation failing**: Verify `BUILT_IN_FORGE_API_KEY` is set
**Admin dashboard not accessible**: Ensure user role is set to 'admin' in database

## 📞 Support

For issues or questions:
1. Check the Manus documentation
2. Review error logs in `.manus-logs/`
3. Check database connection in Manus UI
4. Verify all environment variables are set

## 📄 License

MIT License - Feel free to use and modify for your needs.

---

**Built with:** React 19 + Tailwind 4 + Express 4 + tRPC 11 + MySQL + Manus Platform
