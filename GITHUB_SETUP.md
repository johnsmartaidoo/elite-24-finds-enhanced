# GitHub Deployment Guide

## Push Code to GitHub

Your Elite 24 Finds Enhanced platform is ready to be pushed to GitHub. Follow these steps:

### Option 1: Using Manus Management UI (Recommended)

1. Open the **Management UI** (click the panel icon in top-right)
2. Navigate to **Settings** → **GitHub**
3. Click **Connect GitHub** and authenticate with your account
4. Select or create repository: `elite-24-finds-enhanced`
5. Click **Export to GitHub**
6. Manus will securely push all code

### Option 2: Manual Push (If Repository Already Created)

```bash
cd /home/ubuntu/elite-24-finds-enhanced

# Configure git
git config user.email "your-email@github.com"
git config user.name "Your Name"

# Set remote URL with PAT token
git remote set-url origin https://YOUR_USERNAME:YOUR_PAT_TOKEN@github.com/YOUR_USERNAME/elite-24-finds-enhanced.git

# Push to GitHub
git push -u origin main
```

## Repository Structure

```
elite-24-finds-enhanced/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Home and Dashboard pages
│   │   ├── components/    # Reusable UI components
│   │   └── index.css      # Clickbait color scheme
│   └── public/            # Static assets (robots.txt, favicon)
├── server/                # Express backend
│   ├── routers.ts         # tRPC procedures
│   ├── db.ts              # Database queries
│   ├── db.helpers.ts      # Helper functions
│   ├── integrations/
│   │   ├── shopify.ts     # Shopify API client
│   │   └── amazonDeals.ts # Amazon deals scraper
│   └── jobs/
│       └── amazonDealsJob.ts # Hourly automation
├── drizzle/               # Database schema & migrations
├── package.json           # Dependencies
├── DEPLOYMENT.md          # Deployment guide
└── todo.md               # Feature checklist
```

## Key Features Implemented

### 1. Shopify Integration
- **Store**: home-store-351297.myshopify.com
- **Sync**: Bidirectional product sync
- **Inventory**: Real-time inventory management
- **Location**: `server/integrations/shopify.ts`

### 2. Amazon Deals Automation
- **Frequency**: Runs hourly automatically
- **Sources**: CamelCamelCamel, Lightning Deals, Best Sellers
- **Filtering**: 20%+ discount, 4+ rating minimum
- **Shopify Sync**: Automatically syncs deals to your store
- **Location**: `server/integrations/amazonDeals.ts` & `server/jobs/amazonDealsJob.ts`

### 3. Frontend Features
- **Clickbait Design**: Neon purple, red, green color scheme
- **Responsive**: Mobile, tablet, desktop optimized
- **Traffic Boosting**: Trending products, email capture, social sharing
- **Search**: Real-time product search with autocomplete
- **Filtering**: Category, price range, ratings

### 4. Admin Dashboard
- **Route**: `/admin` or `/dashboard` (hidden from public)
- **Auth**: Role-based access (admin only)
- **Features**: Product management, bulk operations, analytics, image generation
- **Location**: `client/src/pages/Dashboard.tsx`

### 5. AI Features
- **Image Generation**: 8K clickbait-style product images
- **Content**: Auto-generated descriptions, captions, tags
- **LLM**: Integrated with Manus built-in LLM API
- **Location**: `server/integrations/amazonDeals.ts`

### 6. SEO Enhancements
- **Meta Tags**: Title, description, keywords
- **Open Graph**: Social media sharing
- **Twitter Cards**: Tweet-optimized previews
- **Sitemap**: Dynamic XML sitemap generation
- **Robots.txt**: Search engine crawling rules
- **JSON-LD**: Structured data for search engines

## Environment Variables

Required environment variables (auto-configured in Manus):

```
DATABASE_URL=mysql://...
JWT_SECRET=...
VITE_APP_ID=...
OAUTH_SERVER_URL=...
SHOPIFY_STORE_NAME=home-store-351297
SHOPIFY_ACCESS_TOKEN=...
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
BUILT_IN_FORGE_API_KEY=...
BUILT_IN_FORGE_API_URL=...
```

## Running Locally

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Start production server
pnpm start
```

## Deployment Options

### Manus Platform (Recommended)
- Built-in hosting with custom domains
- Automatic SSL certificates
- Database included
- CDN for images
- Click "Publish" in Management UI

### External Hosting
- Railway, Render, Vercel, Netlify
- Requires environment variable setup
- May have compatibility issues with Shopify/Amazon integrations

## Monitoring & Logs

### Development Logs
- `.manus-logs/devserver.log` - Server startup and errors
- `.manus-logs/browserConsole.log` - Client-side logs
- `.manus-logs/networkRequests.log` - API calls
- `.manus-logs/sessionReplay.log` - User interactions

### Production Logs
- Available in Manus Dashboard
- Real-time monitoring and alerts

## Troubleshooting

### Shopify Integration Issues
1. Verify `SHOPIFY_STORE_NAME` matches your store
2. Check `SHOPIFY_ACCESS_TOKEN` has required scopes
3. Test connection: Check admin dashboard

### Amazon Deals Not Updating
1. Check `/server/jobs/amazonDealsJob.ts` is running
2. Verify LLM API key is configured
3. Check database connection
4. Review logs in `.manus-logs/`

### Admin Dashboard Not Accessible
1. Ensure user role is set to 'admin' in database
2. Clear browser cache and cookies
3. Check authentication status with `useAuth()` hook

## Next Steps

1. **Customize Colors**: Edit `client/src/index.css` to match your brand
2. **Add Categories**: Update categories in `client/src/pages/Home.tsx`
3. **Configure Notifications**: Set up email alerts for admin events
4. **Add Payment Processing**: Integrate Stripe for checkout
5. **Analytics Dashboard**: Add more detailed metrics and KPIs

## Support & Documentation

- **Manus Docs**: https://docs.manus.im
- **React Docs**: https://react.dev
- **Shopify API**: https://shopify.dev/api
- **tRPC Docs**: https://trpc.io

---

**Ready to deploy?** Click the **Publish** button in the Manus Management UI!
