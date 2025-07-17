# 🚀 Deployment Guide

## Step 1: Create GitHub Repository

1. Go to https://github.com and sign in
2. Click the "+" icon → "New repository"
3. Repository name: `division-shape-viewer` (or your choice)
4. Make it **Public**
5. Don't initialize with README, .gitignore, or license
6. Click "Create repository"

## Step 2: Push Code to GitHub

After creating the repository, run these commands in your terminal:

```bash
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/division-shape-viewer.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy with Render (Recommended)

1. Go to https://render.com and sign up (free tier available)
2. Click "New +" → "Web Service"
3. Connect your GitHub account
4. Select your `division-shape-viewer` repository
5. Configure deployment:
   - **Name**: `division-shape-viewer` (or your choice)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python backend.py`
   - **Instance Type**: `Free` (for testing)
6. Click "Create Web Service"

Your app will be available at: `https://your-app-name.onrender.com`

## Alternative: Deploy with Railway

1. Go to https://railway.app and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect it's a Python app
5. Environment variables (if needed):
   - `PORT`: Will be set automatically
6. Deploy!

## Alternative: Deploy with Heroku

1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Push: `git push heroku main`

## Step 4: Update README

After deployment, update the live demo link in README.md with your actual URL.

## 🔧 Troubleshooting

**If deployment fails:**
1. Check the build logs on your deployment platform
2. Ensure all dependencies are in `requirements.txt`
3. Verify `Procfile` and `runtime.txt` are correct
4. Make sure the Flask app listens on the correct port (already configured)

**For custom domain:**
- Most platforms offer custom domain options in their dashboard
- Update DNS settings to point to your deployment platform

## 📱 Making Updates

To update your deployed app:
1. Make changes locally
2. Commit: `git add . && git commit -m "Your update message"`
3. Push: `git push origin main`
4. The deployment platform will automatically redeploy

## 🌟 Features Ready for Production

✅ Production-ready Flask configuration  
✅ Environment-based port configuration  
✅ Proper .gitignore for Python projects  
✅ Deployment files (Procfile, runtime.txt)  
✅ CORS enabled for frontend-backend communication  
✅ Responsive design for mobile/desktop  
✅ Error handling and user feedback  

## 🎯 Next Steps

After deployment, you can:
- Add real Overture Maps data integration
- Set up monitoring and analytics
- Add user authentication
- Implement caching for better performance
- Add more map features and export options
