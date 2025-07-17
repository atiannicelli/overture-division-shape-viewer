# Railway Deployment Guide

## Quick Railway Deployment

1. **Sign up for Railway**:
   - Go to https://railway.app
   - Sign up with your GitHub account

2. **Deploy from GitHub**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `overture-division-shape-viewer` repository
   - Railway will auto-detect it's a Python app

3. **Environment Variables** (if needed):
   - Railway will automatically set PORT
   - No additional config needed for basic deployment

4. **Deploy**:
   - Railway will handle the DuckDB compilation
   - Build typically takes 2-3 minutes
   - You'll get a live URL when complete

## Alternative: Fly.io

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login and Deploy**:
   ```bash
   fly auth login
   fly launch
   ```

3. **Follow prompts** - Fly will create a Dockerfile automatically

## Alternative: DigitalOcean

1. **Sign up** at https://cloud.digitalocean.com
2. **Create App** → "Deploy from GitHub"
3. **Select repository** and configure:
   - Build Command: `pip install -r requirements.txt`
   - Run Command: `python backend.py`

## Why These Work Better:

- **More Build Memory**: Can handle DuckDB compilation
- **Better Resource Allocation**: Don't timeout during pip install
- **Optimized for Python**: Better dependency management
- **Docker Support**: More control over build environment
