# Quick Start Guide

Get started with VaultPlay Draw Worker in 5 minutes.

## Prerequisites

- Cloudflare Workers account (free tier works)
- Node.js installed (for Wrangler CLI)
- Git installed
- GitHub account (for audit publishing)

## 1. Clone and Deploy (2 minutes)

```bash
# Clone repository
git clone https://github.com/vaultplay-dev/vaultplay-draw-worker.git
cd vaultplay-draw-worker

# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Copy example config
cp wrangler.toml.example wrangler.toml

# Edit wrangler.toml and configure:
# - Remove 'account_id' line if using Git integration
# - Or add your account ID from Cloudflare dashboard
# - Update GITHUB_REPO_OWNER to your GitHub username

# Deploy
npx wrangler deploy --env production
```

Your worker is now live at: `https://vaultplay-draw-worker.YOUR-SUBDOMAIN.workers.dev`

## 2. Test Basic Draw (1 minute)

```bash
curl -X POST https://vaultplay-draw-worker.YOUR-SUBDOMAIN.workers.dev/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "randomness": "abc123def456789012345678901234ab",
    "entries": [
      {"entryCode": "ENTRY-001"},
      {"entryCode": "ENTRY-002"},
      {"entryCode": "ENTRY-003"}
    ]
  }'
```

Expected response: Full draw results with winner at rank 1.

## 3. Enable GitHub Publishing (Optional, 2 minutes)

### Create Audit Repository

1. Go to GitHub → New Repository
2. Name: `vaultplay-draw-history`
3. Public repository
4. Create

### Generate Token

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained
2. Generate new token
3. Repository access: Only `vaultplay-draw-history`
4. Permissions: Contents (read & write)
5. Copy token

### Add to Worker

```bash
# Set GitHub token (secret)
npx wrangler secret put GITHUB_TOKEN --env production
# Paste your token when prompted

# Set repository details (in wrangler.toml)
[env.production.vars]
GITHUB_REPO_OWNER = "your-github-username"
GITHUB_REPO_NAME = "vaultplay-draw-history"
GITHUB_BRANCH = "main"

# Redeploy
npx wrangler deploy --env production
```

## 4. Test Complete Flow (1 minute)

```bash
curl -X POST https://your-worker-url/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "randomness": "def789ghi012345678901234567890ab",
    "entries": [
      {"entryCode": "TEST-001"},
      {"entryCode": "TEST-002"}
    ],
    "competition": {
      "id": "TEST-001",
      "name": "Test Draw",
      "mode": "test"
    },
    "randomnessSource": {
      "provider": "test",
      "timestamp": "2025-01-15T14:00:00Z"
    }
  }'
```

Check response for:
- `"success": true`
- `"audit.github.published": true`
- GitHub commit URL in response
- GitHub file path like: `test/2025-01/test-draw-2025-01-15-1400/draw.json`

Visit your GitHub repository to see the audit bundle!

## 5. Configure Custom Domain (Optional)

### In Cloudflare Dashboard

1. Workers & Pages → Your Worker
2. Settings → Domains & Routes
3. Add Custom Domain
4. Enter: `draw.yourdomain.com`
5. Add Domain

Your worker is now at: `https://draw.yourdomain.com/startdraw`

## Common Issues

### "Account ID not found"

Edit `wrangler.toml` and add your account ID from Cloudflare dashboard.

### "GitHub token not configured"

Run: `npx wrangler secret put GITHUB_TOKEN --env production`

### "Randomness must be hexadecimal"

Use only 0-9, a-f, A-F characters in randomness field.

### "GitHub publishing failed"

Check:
1. Token is valid and not expired
2. Repository exists and name is correct
3. Token has write access to repository

## Next Steps

- **Read Full Documentation:** [README.md](README.md)
- **GitHub Setup Guide:** [GITHUB_SETUP.md](GITHUB_SETUP.md)
- **Make.com Integration:** [MAKE_INTEGRATION.md](MAKE_INTEGRATION.md)
- **Add Rate Limiting:** Cloudflare Dashboard → Security → WAF
- **Enable Bot Protection:** Cloudflare Dashboard → Security → Bots
- **Monitor Logs:** Cloudflare Dashboard → Workers → Your Worker → Logs

## Production Checklist

Before going live:

- [ ] Custom domain configured
- [ ] GitHub audit repository created and public
- [ ] GitHub token set with correct permissions
- [ ] Rate limiting enabled (100 req/min recommended)
- [ ] Bot protection enabled
- [ ] Health check working: `curl https://your-domain/health`
- [ ] Test draw completes successfully
- [ ] GitHub audit bundle appears in repository
- [ ] GitHub release created (for live mode)
- [ ] Monitoring/alerts configured

## Getting Real Randomness

For production draws, use public randomness sources:

### drand (Recommended)

```bash
# Get latest drand randomness
curl https://api.drand.sh/public/latest

# Use in draw
{
  "randomness": "<randomness from drand>",
  "randomnessSource": {
    "provider": "drand",
    "round": <round>,
    "timestamp": "<time>",
    "verificationUrl": "https://api.drand.sh/public/<round>"
  }
}
```

### Bitcoin Block Hash

```bash
# Get latest Bitcoin block
curl https://blockchain.info/latestblock

# Use block hash as randomness
{
  "randomness": "<block_hash>",
  "randomnessSource": {
    "provider": "bitcoin",
    "round": <block_height>,
    "verificationUrl": "https://blockchain.info/block/<block_hash>"
  }
}
```

## Support

- **Issues:** https://github.com/vaultplay-dev/vaultplay-draw-worker/issues
- **Discussions:** https://github.com/vaultplay-dev/vaultplay-draw-worker/discussions
- **Website:** https://vaultplay.co.uk

## Quick Reference

### Endpoints

- `POST /startdraw` - Execute draw
- `GET /health` - Health check
- `GET /` - Health check

### Environment Variables

- `GITHUB_TOKEN` (secret) - GitHub Personal Access Token
- `GITHUB_REPO_OWNER` - Repository owner username
- `GITHUB_REPO_NAME` - Repository name
- `GITHUB_BRANCH` - Branch name (default: main)

### CLI Commands

```bash
# Deploy
wrangler deploy --env production

# View logs
wrangler tail --env production

# Set secret
wrangler secret put GITHUB_TOKEN --env production

# List secrets
wrangler secret list --env production

# Delete secret
wrangler secret delete GITHUB_TOKEN --env production
```

---

**You're all set!** 🎉 Your draw system is now live and fully transparent.
