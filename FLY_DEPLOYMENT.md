# Fly.io Deployment Guide for Division Shape Viewer

## 🚀 Quick Deploy to Fly.io

### Step 1: Install Fly CLI

**Option A: Using Homebrew (recommended for macOS)**
```bash
brew install flyctl
```

**Option B: Using installer script**
```bash
curl -L https://fly.io/install.sh | sh
```

**Option C: Direct download**
- Visit https://github.com/superfly/flyctl/releases
- Download the appropriate binary for your system

### Step 2: Login to Fly.io

```bash
flyctl auth login
```
This will open your browser to authenticate with Fly.io.

### Step 3: Deploy Your App

From your project directory:

```bash
# Launch the app (this will create and deploy)
flyctl launch

# Follow the prompts:
# - App name: overture-division-shape-viewer (or choose your own)
# - Region: Choose closest to you (e.g., sjc for San Jose)
# - PostgreSQL database: No (we're using DuckDB)
# - Redis database: No
# - Deploy now: Yes
```

### Step 4: Monitor Deployment

```bash
# Watch the deployment logs
flyctl logs

# Check app status
flyctl status

# Open your deployed app
flyctl open
```

## 🔧 Configuration Details

### Files Created for Fly.io:
- `fly.toml` - Fly.io configuration
- `Dockerfile` - Optimized container setup
- Updated `backend.py` - Uses port 8080 (Fly.io standard)

### Key Configuration:
```toml
# In fly.toml
[http_service]
  internal_port = 8080  # Matches our Flask app
  force_https = true    # Automatic HTTPS
  
[[vm]]
  memory = '1gb'        # Enough for DuckDB compilation
```

## 🛠️ Useful Commands

```bash
# Deploy updates
flyctl deploy

# View logs
flyctl logs

# SSH into your app
flyctl ssh console

# Scale your app
flyctl scale count 2

# Set environment variables
flyctl secrets set MY_SECRET=value

# Check app info
flyctl info
```

## 🔍 Troubleshooting

### If build fails:
```bash
# Check build logs
flyctl logs --app your-app-name

# Rebuild from scratch
flyctl deploy --no-cache
```

### If DuckDB installation fails:
- The Dockerfile includes build-essential and gcc
- 1GB memory should be sufficient
- If issues persist, try increasing VM memory in fly.toml

### Common Issues:
1. **Port binding**: Make sure backend.py uses port 8080
2. **Build timeout**: Increase VM memory in fly.toml
3. **Dependencies**: Ensure requirements.txt is complete

## 💰 Pricing

- **Free tier**: 3 shared-cpu-1x 256mb VMs
- **This app uses**: 1 shared-cpu-1x 1gb VM
- **Cost**: ~$2-5/month for light usage
- **Scaling**: Can increase based on traffic

## 🌐 Custom Domain (Optional)

```bash
# Add your domain
flyctl certs add yourdomain.com

# Check certificate status
flyctl certs show yourdomain.com
```

## ✅ Deployment Checklist

- [ ] Fly CLI installed
- [ ] Authenticated with `flyctl auth login`
- [ ] Project committed to Git
- [ ] Run `flyctl launch` from project directory
- [ ] Monitor deployment with `flyctl logs`
- [ ] Test app with `flyctl open`

Your Division Shape Viewer will be live at: `https://your-app-name.fly.dev`

## 🔄 Auto-deployment (GitHub Actions)

To set up automatic deployments from GitHub:

1. Generate Fly API token: `flyctl auth token`
2. Add to GitHub Secrets as `FLY_API_TOKEN`
3. Create `.github/workflows/fly.yml` (available on request)

Fly.io is excellent for Python apps with heavy dependencies like DuckDB!
