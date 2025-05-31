# Render Deployment Guide for xAutoDM

## Overview
This guide covers deploying the xAutoDM application to Render with the smart batch scraper functionality.

## Prerequisites
- GitHub repository with your code
- Render account
- Required environment variables and API keys

## Deployment Steps

### 1. Repository Setup
Ensure your repository has:
- ✅ `Dockerfile` (configured for production)
- ✅ `render.yaml` (service configuration)
- ✅ `backend/` directory with Python scripts
- ✅ `backend/requirements.txt` with dependencies
- ✅ Health check endpoint at `/api/healthz`

### 2. Render Service Configuration

#### Service Settings:
- **Name**: `xdm-frontend-final-preprod`
- **Environment**: `Docker`
- **Region**: `Singapore (Southeast Asia)`
- **Instance Type**: `Starter` (0.5 CPU, 512 MB RAM)
- **Branch**: `scrapercodebase`
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `.`
- **Health Check Path**: `/api/healthz`

#### Build Settings:
- **Auto-Deploy**: `Off` (manual deploys recommended for production)
- **Pre-Deploy Command**: Leave empty (handled in Dockerfile)

### 3. Required Environment Variables

Set these in your Render dashboard:

#### Database & Authentication:
```
DB_URL=your_mongodb_connection_string
NEXTAUTH_URL=https://xdm-frontend-final-preprod.onrender.com
NEXTAUTH_SECRET=auto_generated_by_render
```

#### OAuth Configuration:
```
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

#### External Services:
```
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
OPENAI_API_KEY=your_openai_api_key
RESEND_API_KEY=your_resend_api_key
```

#### Python Configuration:
```
PYTHON_EXECUTABLE=python3
TWS_RAISE_WHEN_NO_ACCOUNT=1
PORT=3000
NODE_ENV=production
```

### 4. Deployment Process

1. **Push your code** to the `scrapercodebase` branch
2. **Go to Render Dashboard** → Your Service
3. **Click "Manual Deploy"** → Deploy Latest Commit
4. **Monitor the build logs** for any issues
5. **Check health endpoint** at `/api/healthz` once deployed

### 5. Post-Deployment Verification

#### Health Check
Visit: `https://xdm-frontend-final-preprod.onrender.com/api/healthz`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "xAutoDM",
  "version": "1.0.0",
  "python": {
    "executable": "python3",
    "version": "Python 3.x.x",
    "twscrapeInstalled": true
  },
  "backend": {
    "exists": true,
    "allScriptsExist": true
  }
}
```

#### Test Scraper Functionality
1. Login to your application
2. Go to Leads → Import Leads
3. Try importing a small batch (10-20 followers)
4. Monitor logs in Render dashboard

### 6. Monitoring & Troubleshooting

#### Logs Access
- **Render Dashboard** → Your Service → Logs
- **Real-time logs** available during deployment and runtime

#### Common Issues & Solutions

**Python Script Not Found:**
```
Error: Failed to start Python script
Solution: Check that backend/ directory is properly copied in Dockerfile
```

**Python Dependencies Missing:**
```
Error: ModuleNotFoundError: No module named 'twscrape'
Solution: Verify requirements.txt is properly installed in Dockerfile
```

**Health Check Failing:**
```
Status: 503 Service Unavailable
Solution: Check /api/healthz endpoint and fix any missing dependencies
```

**Memory Issues:**
```
Error: Container killed (OOMKilled)
Solution: Upgrade to higher instance type or optimize memory usage
```

### 7. Performance Optimization

#### Instance Scaling
- **Starter**: Good for testing (512 MB RAM)
- **Standard**: Recommended for production (2 GB RAM)
- **Pro**: For high-volume usage (4+ GB RAM)

#### Monitoring Metrics
- **Response Time**: Monitor via health checks
- **Memory Usage**: Check Render metrics dashboard
- **Error Rate**: Monitor application logs
- **Scraping Success Rate**: Check application analytics

### 8. Security Considerations

#### Environment Variables
- ✅ Never commit secrets to repository
- ✅ Use Render's environment variable management
- ✅ Rotate API keys regularly

#### Network Security
- ✅ HTTPS enforced by default on Render
- ✅ Health checks use internal network
- ✅ Database connections use secure protocols

### 9. Backup & Recovery

#### Database Backups
- Configure MongoDB Atlas automated backups
- Test restore procedures regularly

#### Code Backups
- GitHub repository serves as code backup
- Tag releases for easy rollback

### 10. Scaling Considerations

#### Horizontal Scaling
- Render supports multiple instances
- Consider load balancing for high traffic

#### Database Scaling
- MongoDB Atlas auto-scaling
- Connection pooling optimization

## Support

For deployment issues:
1. Check Render build logs
2. Verify environment variables
3. Test health endpoint
4. Review application logs
5. Contact support if needed

## Deployment Checklist

- [ ] Repository updated with latest code
- [ ] Environment variables configured
- [ ] Health check endpoint working
- [ ] Python dependencies installed
- [ ] Database connection tested
- [ ] Manual deploy completed
- [ ] Post-deployment verification passed
- [ ] Monitoring setup configured 