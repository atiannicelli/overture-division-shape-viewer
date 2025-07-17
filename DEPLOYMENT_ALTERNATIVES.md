# Alternative Deployment Methods (Without Local Fly CLI)

Since you're having issues with the Fly CLI installation on macOS 26.0, here are alternative ways to deploy:

## Method 1: Deploy via GitHub Actions (Recommended)

1. **Push your code to GitHub** (already done):
   ```bash
   git push origin main
   ```

2. **Sign up for Fly.io**:
   - Go to https://fly.io/
   - Sign up with your GitHub account

3. **Create the app via Fly.io Dashboard**:
   - Go to https://fly.io/dashboard
   - Click "Create App"
   - App name: `overture-division-shape-viewer`
   - Region: Choose closest to you
   - Don't add databases

4. **Get your Fly API Token**:
   - In Fly.io dashboard, go to Account → Access Tokens
   - Create a new token
   - Copy the token

5. **Add token to GitHub Secrets**:
   - Go to your GitHub repo: https://github.com/atiannicelli/overture-division-shape-viewer
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `FLY_API_TOKEN`
   - Value: Paste your Fly token
   - Click "Add secret"

6. **Trigger deployment**:
   - Make any small change and push to main branch
   - GitHub Actions will automatically deploy to Fly.io
   - Check progress in GitHub → Actions tab

## Method 2: Try Fly CLI with Different Download

```bash
# Alternative download method
mkdir -p ~/.local/bin
cd ~/.local/bin
curl -L https://github.com/superfly/flyctl/releases/latest/download/flyctl_Darwin_arm64.tar.gz -o flyctl.tar.gz
tar -xzf flyctl.tar.gz
chmod +x flyctl
export PATH="$HOME/.local/bin:$PATH"
./flyctl version
```

Then add to your shell profile:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Method 3: Use Docker Desktop + Fly.io

If you have Docker Desktop:

1. **Build locally**:
   ```bash
   docker build -t overture-viewer .
   docker run -p 8080:8080 overture-viewer
   ```

2. **Push to Fly.io** via their web interface once the app is created.

## Method 4: Alternative Platform

If Fly.io continues to be problematic, try **Railway**:

1. Go to https://railway.app
2. Sign up with GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-deploy (handles DuckDB well)

## Current Status

Your project is **100% ready** to deploy to Fly.io. The GitHub Actions method (#1) is the most reliable since it doesn't require local CLI installation.

## Files Ready for Deployment:
- ✅ `fly.toml` - App configuration
- ✅ `Dockerfile` - Container setup  
- ✅ `.github/workflows/fly.yml` - Auto-deployment
- ✅ All dependencies configured for DuckDB

Choose Method 1 (GitHub Actions) for the easiest deployment experience!
