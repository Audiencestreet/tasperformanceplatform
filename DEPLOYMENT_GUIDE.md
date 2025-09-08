# Deployment Guide - Affiliate Tracking Platform

## Overview
This guide covers deploying the Affiliate Tracking Platform to Cloudflare Pages with D1 database and production PX API integration.

## Prerequisites

### Required Accounts
1. **Cloudflare Account** - For Pages and D1 database
2. **PX Account** - For lead processing API access
3. **GitHub Account** - For code repository (optional)

### Required Tools
- Node.js 18+ 
- npm or yarn
- wrangler CLI
- git

## Local Development Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd webapp
npm install
```

### 2. Environment Configuration
Create `.dev.vars` file for local development:
```bash
# .dev.vars (local development only)
PX_API_TOKEN=your-development-px-token
PX_OFFER_ID=122
PX_DID=+18576880648
```

**⚠️ Never commit `.dev.vars` to git - it's already in .gitignore**

### 3. Database Setup
```bash
# Apply migrations locally
npm run db:migrate:local

# Seed with sample data
npm run db:seed

# Verify database
npm run db:console:local
```

### 4. Build and Test
```bash
# Build application
npm run build

# Start development server
pm2 start ecosystem.config.cjs

# Test endpoints
curl http://localhost:3000/api/dashboard/stats
```

## Production Deployment

### Step 1: Cloudflare Account Setup

#### Install Wrangler CLI
```bash
npm install -g wrangler
```

#### Authenticate with Cloudflare
```bash
wrangler auth login
# Follow browser authentication flow
```

#### Verify Authentication
```bash
wrangler whoami
```

### Step 2: Create Production Database

#### Create D1 Database
```bash
# Create production database
wrangler d1 create webapp-production

# Output will show database ID - copy this
```

#### Update wrangler.jsonc
Replace `database_id` in `wrangler.jsonc` with the actual ID:
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "your-actual-database-id-here"
    }
  ]
}
```

#### Apply Migrations to Production
```bash
wrangler d1 migrations apply webapp-production --remote
```

### Step 3: Configure Secrets

#### Set PX API Credentials
```bash
# Set production PX API token
wrangler pages secret put PX_API_TOKEN

# Set offer ID (if different from default)
wrangler pages secret put PX_OFFER_ID

# Set DID (if different from default)  
wrangler pages secret put PX_DID
```

#### List Configured Secrets
```bash
wrangler pages secret list --project-name webapp
```

### Step 4: Deploy Application

#### Build for Production
```bash
npm run build
```

#### Create Cloudflare Pages Project
```bash
wrangler pages project create webapp \
  --production-branch main \
  --compatibility-date 2024-01-01
```

#### Deploy to Cloudflare Pages
```bash
wrangler pages deploy dist --project-name webapp
```

#### Deployment Output
After successful deployment, you'll receive:
- **Production URL**: `https://webapp.pages.dev`
- **Preview URL**: `https://main.webapp.pages.dev`

### Step 5: Verify Deployment

#### Test API Endpoints
```bash
# Test health check
curl https://webapp.pages.dev/api/dashboard/stats

# Test campaigns endpoint
curl https://webapp.pages.dev/api/campaigns

# Test with sample lead (use actual PX token)
curl -X POST https://webapp.pages.dev/api/test-px \
  -H "Content-Type: application/json" \
  -d '{"api_token": "your-production-px-token"}'
```

## Custom Domain Setup (Optional)

### Add Custom Domain
```bash
# Add your domain to the project
wrangler pages domain add yourdomain.com --project-name webapp
```

### DNS Configuration
1. Add CNAME record in your DNS provider:
   - **Name**: `@` or `www`
   - **Value**: `webapp.pages.dev`

2. Verify domain:
```bash
wrangler pages domain list --project-name webapp
```

## Environment-Specific Configuration

### Development Environment
- Uses local SQLite database (`.wrangler/state/v3/d1`)
- Test PX credentials in `.dev.vars`
- Hot reloading with `wrangler pages dev`

### Production Environment
- Cloudflare D1 database (globally distributed)
- Production PX credentials via secrets
- Edge deployment across Cloudflare network

## Database Management

### Production Database Operations

#### Execute Queries
```bash
# Run SQL queries on production database
wrangler d1 execute webapp-production --remote \
  --command="SELECT COUNT(*) FROM leads"
```

#### Backup Production Data
```bash
# Export production data
wrangler d1 export webapp-production --remote --output=backup.sql
```

#### Restore from Backup
```bash
# Import data to production database
wrangler d1 execute webapp-production --remote --file=backup.sql
```

### Migration Management

#### Create New Migration
```bash
# Create new migration file
touch migrations/0002_add_new_feature.sql
```

#### Apply Specific Migration
```bash
# Apply to local
wrangler d1 migrations apply webapp-production --local

# Apply to production
wrangler d1 migrations apply webapp-production --remote
```

## Monitoring & Maintenance

### View Application Logs
```bash
# View real-time logs
wrangler pages deployment tail --project-name webapp
```

### Performance Monitoring
- **Analytics Dashboard**: Available in Cloudflare dashboard
- **Error Tracking**: Check Workers Analytics
- **Database Metrics**: D1 Analytics in dashboard

### Health Checks
Set up monitoring for critical endpoints:
- `GET /api/dashboard/stats` - Application health
- `POST /api/leads` - Lead processing functionality
- `GET /api/campaigns` - Database connectivity

## Scaling Considerations

### Cloudflare Pages Limits
- **Requests**: 100k/day (free), unlimited (paid)
- **CPU Time**: 10ms (free), 30ms (paid) per request
- **Memory**: 128MB per request
- **File Size**: 25MB per file

### D1 Database Limits
- **Rows Read**: 25M/day (free), 25B/day (paid)
- **Rows Written**: 100k/day (free), 50M/day (paid)
- **Storage**: 5GB (free), 50GB (paid)

### Optimization Tips
- Use database indexes for frequent queries
- Implement caching for dashboard statistics
- Optimize API response sizes
- Monitor PX API rate limits

## Troubleshooting

### Common Deployment Issues

#### Build Failures
```bash
# Clear cache and rebuild
rm -rf dist .wrangler
npm run build
```

#### Database Connection Issues
```bash
# Verify D1 binding
wrangler pages deployment list --project-name webapp

# Check database status
wrangler d1 info webapp-production
```

#### Secret Configuration Issues
```bash
# List all secrets
wrangler pages secret list --project-name webapp

# Update secret
wrangler pages secret put SECRET_NAME --project-name webapp
```

#### PX API Integration Issues
1. **Verify API Token**: Test with `/api/test-px` endpoint
2. **Check Rate Limits**: Monitor PX API response headers
3. **Validate Data Format**: Ensure all required fields are present

### Debug Mode
Enable debug logging by setting environment variable:
```bash
# In wrangler.jsonc
{
  "vars": {
    "DEBUG": "true"
  }
}
```

### Performance Issues
- **Slow Queries**: Check D1 Analytics for query performance
- **High CPU Usage**: Review complex operations in ping/post workflow
- **Memory Issues**: Optimize large data processing operations

## Security Checklist

### Pre-Deployment Security
- [ ] All secrets stored in Cloudflare (not in code)
- [ ] `.dev.vars` file in `.gitignore`
- [ ] Input validation on all API endpoints
- [ ] SQL injection protection (prepared statements)
- [ ] CORS properly configured

### Production Security
- [ ] Custom domain with SSL certificate
- [ ] API rate limiting implemented
- [ ] Monitoring and alerting configured
- [ ] Regular security updates
- [ ] Backup strategy in place

## Continuous Deployment

### GitHub Actions Setup
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: webapp
          directory: dist
```

### Required GitHub Secrets
- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

## Rollback Procedure

### Quick Rollback
```bash
# List deployments
wrangler pages deployment list --project-name webapp

# Rollback to previous deployment
wrangler pages deployment rollback --project-name webapp
```

### Database Rollback
```bash
# Restore from backup
wrangler d1 execute webapp-production --remote --file=backup.sql
```

## Support & Resources

### Documentation
- **Cloudflare Pages**: https://developers.cloudflare.com/pages/
- **Cloudflare D1**: https://developers.cloudflare.com/d1/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/
- **PX API**: Check your PX account documentation

### Getting Help
1. **Cloudflare Community**: https://community.cloudflare.com/
2. **GitHub Issues**: Create issues in your repository
3. **PX Support**: Contact through your PX account portal

This deployment guide ensures a secure, scalable production deployment of your affiliate tracking platform with proper monitoring and maintenance procedures.