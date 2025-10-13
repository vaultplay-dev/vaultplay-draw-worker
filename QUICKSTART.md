# Quick Start Guide

Get started with VaultPlay Draw Worker v1.3 in 5 minutes.

## Prerequisites

- Cloudflare Workers account (free tier works)
- Node.js installed (for Wrangler CLI)
- Git installed
- GitHub account (for audit publishing)

## What's New in V1.3

- 🎲 **Auto-fetch randomness from drand** - Worker can fetch randomness automatically, eliminating the manipulation window
- 📊 **Enhanced disqualification tracking** - Full transparency for quiz-based entry filtering
- 🔒 **Improved security** - Additional validation and error handling

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

### Option A: Manual Randomness (Traditional)

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

### Option B: Auto-fetch from drand (NEW in v1.3) 🎲

```bash
curl -X POST https://vaultplay-draw-worker.YOUR-SUBDOMAIN.workers.dev/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "randomnessSource": {
      "autoFetch": true,
      "provider": "drand"
    },
    "entries": [
      {"entryCode": "ENTRY-001"},
      {"entryCode": "ENTRY-002"},
      {"entryCode": "ENTRY-003"}
    ]
  }'
```

**Why auto-fetch?** Eliminates the manipulation window - nobody can see the randomness before the draw is executed. The worker fetches it directly from drand at draw time.

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

### With Auto-fetch (Recommended)

```bash
curl -X POST https://your-worker-url/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "randomnessSource": {
      "autoFetch": true,
      "provider": "drand"
    },
    "entries": [
      {"entryCode": "TEST-001", "gamertag": "Player1"},
      {"entryCode": "TEST-002", "gamertag": "Player2"}
    ],
    "competition": {
      "id": "TEST-001",
      "name": "Test Draw",
      "mode": "test"
    }
  }'
```

### With Manual Randomness

```bash
curl -X POST https://your-worker-url/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "randomness": "def789ghi012345678901234567890ab",
    "entries": [
      {"entryCode": "TEST-001", "gamertag": "Player1"},
      {"entryCode": "TEST-002", "gamertag": "Player2"}
    ],
    "competition": {
      "id": "TEST-001",
      "name": "Test Draw",
      "mode": "test"
    },
    "randomnessSource": {
      "provider": "manual",
      "timestamp": "2025-01-15T14:00:00Z"
    }
  }'
```

Check response for:
- `"success": true`
- `"audit.github.published": true`
- GitHub commit URL in response
- GitHub file path like: `test/2025-01/test-draw-2025-01-15-1400/draw.json`
- If auto-fetch used: `randomness.fetchedByWorker: true` in audit bundle

Visit your GitHub repository to see the audit bundle!

## 5. Test Entry Disqualification (NEW in v1.3)

```bash
curl -X POST https://your-worker-url/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "randomnessSource": {
      "autoFetch": true,
      "provider": "drand"
    },
    "entries": [
      {
        "entryCode": "ENTRY-001",
        "gamertag": "CorrectAnswer",
        "quiz": {
          "question": "What is 2+2?",
          "answerGiven": "4",
          "answerCorrect": true
        }
      },
      {
        "entryCode": "ENTRY-002",
        "gamertag": "WrongAnswer",
        "quiz": {
          "question": "What is 2+2?",
          "answerGiven": "5",
          "answerCorrect": false
        }
      }
    ],
    "competition": {
      "id": "QUIZ-TEST-001",
      "name": "Quiz Test Draw",
      "mode": "test"
    }
  }'
```

Check response shows:
- `qualifiedEntries: 1`
- `disqualifiedEntries: 1`
- Disqualified entry has `status: "disqualified"` and `disqualificationReason: "Quiz answered incorrectly"`
- Only qualified entries appear in `topWinners`

## 6. Configure Custom Domain (Optional)

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

Use only 0-9, a-f, A-F characters in randomness field, OR use auto-fetch instead.

### "Failed to fetch randomness from drand"

The drand API may be temporarily unavailable. Either:
1. Try again (usually works immediately)
2. Use manual randomness as fallback
3. Check drand status at https://api.drand.sh/public/latest

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
- [ ] Test draw with auto-fetch completes successfully
- [ ] GitHub audit bundle appears in repository
- [ ] GitHub release created (for live mode)
- [ ] Monitoring/alerts configured
- [ ] Decide: auto-fetch vs manual randomness for production

## Getting Randomness for Production Draws

### Option 1: Auto-fetch (Recommended for v1.3+) 🎲

**Advantages:**
- ✅ Zero manipulation window - randomness fetched at draw time
- ✅ No manual steps required
- ✅ Automatic verification URL included
- ✅ Worker handles everything

**How to use:**
```json
{
  "randomnessSource": {
    "autoFetch": true,
    "provider": "drand"
  },
  "entries": [...],
  "competition": {...}
}
```

The worker will:
1. Fetch latest randomness from drand
2. Include round number and timestamp
3. Add verification URL to audit bundle
4. Mark as `fetchedByWorker: true`

### Option 2: Manual drand (Traditional)

**When to use:**
- You want to pre-announce the specific drand round
- You need to coordinate timing with other systems
- You want explicit control over the randomness source

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

### Option 3: Bitcoin Block Hash

**When to use:**
- You want even more transparency/publicity
- You can wait for block confirmation
- Your audience is familiar with Bitcoin

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

### Request Fields (v1.3)

**Required (pick one):**
- `randomness` (string) - Manual hex randomness
- `randomnessSource.autoFetch` (boolean) - Auto-fetch from drand

**Required:**
- `entries` (array) - Entry objects with `entryCode`

**Optional:**
- `drawRound` (string|number) - Draw identifier
- `competition` (object) - Enables GitHub publishing
  - `id` (string) - Competition ID
  - `name` (string) - Competition name
  - `mode` (string) - "live" or "test"
- `randomnessSource` (object) - Randomness metadata
  - `provider` (string) - Source provider
  - `autoFetch` (boolean) - Enable auto-fetch
  - `round` (string|number) - Source round/block
  - `timestamp` (string) - ISO timestamp
  - `verificationUrl` (string) - Verification link

**Entry Fields:**
- `entryCode` (string, required) - Unique entry identifier
- `gamertag` (string, optional) - Display name
- `email` (string, optional) - Hashed in results
- `entryTimestamp` (string, optional) - Entry time
- `location` (object, optional) - Geographic data
  - `country` (string)
  - `region` (string)
- `quiz` (object, optional) - Quiz validation
  - `question` (string)
  - `answerGiven` (string)
  - `answerCorrect` (boolean)

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

**You're all set!** 🎉 Your draw system is now live with transparent, verifiable randomness using v1.3's auto-fetch feature.
