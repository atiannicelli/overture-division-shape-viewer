# Deployment Guide for Division Shapes App

## Prerequisites
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Create Fly.io account: `flyctl auth signup`
3. Login: `flyctl auth login`

## Deployment Steps

### 1. Launch the App
```bash
# Navigate to project directory
cd /Users/atiannicelli/division_shapes

# Launch app (will create fly.toml if not exists)
flyctl launch --name division-shapes --region ord --no-deploy

# The launch command will detect our Dockerfile and fly.toml
```

### 2. Deploy the App
```bash
# Deploy to Fly.io
flyctl deploy

# Monitor deployment
flyctl logs

# Check status
flyctl status
```

### 3. Access Your App
```bash
# Get the app URL
flyctl info

# Open in browser
flyctl open
```

## Configuration Details

### Memory & Performance
- **Memory**: 2GB allocated for DuckDB spatial operations
- **CPU**: 1 shared CPU (sufficient for moderate traffic)
- **Region**: Chicago (ORD) for good US coverage
- **Auto-scaling**: Machines auto-start/stop to save costs

### Environment Variables
- `FLASK_ENV=production` - Production mode
- `PORT=4000` - App listens on port 4000

### Health Monitoring
- Health check endpoint: `/api/health`
- Logs: `flyctl logs`
- Metrics: `flyctl dashboard`

## API Endpoints (Once Deployed)
```
POST https://division-shapes.fly.dev/api/search
- Body: {"query": "Texas", "filters": {"city": true, "state": true, "county": true}}

GET https://division-shapes.fly.dev/api/geometry/<division_id>
- Returns simplified geometry for the division

GET https://division-shapes.fly.dev/api/health
- Health check endpoint
```

## Testing the Deployment
Once deployed, test with:
```bash
# Test search
curl -X POST https://division-shapes.fly.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Texas", "filters": {"city": true, "state": true, "county": true}}'

# Test geometry fetch (use an ID from search results)
curl https://division-shapes.fly.dev/api/geometry/d47f5538-d91b-49b5-82b5-f12cf2c87728
```

## Cost Estimate
- **2GB Memory Machine**: ~$0.0000236/second when running
- **Auto-stop enabled**: Only pay when active
- **Estimated monthly cost**: $5-15 depending on usage

## Troubleshooting

### If deployment fails:
```bash
# Check logs
flyctl logs

# SSH into machine
flyctl ssh console

# Restart machine
flyctl machine restart
```

### Common issues:
1. **Memory errors**: DuckDB needs 2GB+ for spatial operations
2. **Network timeouts**: S3 access requires good network connectivity
3. **Build failures**: Ensure Dockerfile includes build-essential for DuckDB compilation

## Monitoring Production
```bash
# View logs in real-time
flyctl logs -f

# Check machine status
flyctl status --all

# View app metrics
flyctl dashboard
```

Ready to deploy? Run: `flyctl launch --name division-shapes --region ord`
