# GitHub Audit Publishing Setup Guide

This guide walks you through setting up automatic audit bundle publishing to GitHub.

## Prerequisites

- GitHub account
- Cloudflare Worker deployed
- Repository for storing audit bundles

## Step 1: Create Audit Repository

### 1.1 Create Repository

1. Go to GitHub and create a new repository
2. Repository name: `vaultplay-draw-history` (or your preferred name)
3. Visibility: **Public** (critical for transparency)
4. Initialize with README: ✓ Yes
5. Add .gitignore: None
6. License: MIT (recommended)
7. Click "Create repository"

### 1.2 Create Directory Structure

Create initial folders in your repository:

1. In GitHub, click "Add file" → "Create new file"
2. Name: `live/.gitkeep`
3. Commit with message: "Add live draws folder"
4. Repeat for `test/.gitkeep`

Your structure should look like:
```
vaultplay-draw-history/
├── README.md
├── LICENSE
├── live/
│   └── .gitkeep
└── test/
    └── .gitkeep
```

### 1.3 Update Repository README

Add this to your `README.md`:

```markdown
# VaultPlay Draw History

Complete public audit trail of all draws performed by VaultPlay.

## About

This repository contains cryptographically verifiable audit bundles for every draw conducted using the VaultPlay Draw Worker. Each bundle includes:

- Complete competition metadata
- Randomness source and verification URL
- All entries and their cryptographic scores
- Full ranking results
- Bundle integrity hash

## Structure

- `/live/` - Production draws for real competitions
  - Organized by date: `/live/YYYY-MM/competition-name/`
  - Each live draw has a corresponding GitHub release
- `/test/` - Test draws for quality assurance
  - Organized by date: `/test/YYYY-MM/test-YYYY-MM-DD-###/`
  - Test draws are committed but not released

## Why Test Draws Are Public

We publish test draws to demonstrate:
- Our draw system is continuously tested
- We perform regular quality assurance
- Nothing is hidden from public scrutiny
- Complete transparency in our process

Test draws are clearly labeled and use test competition IDs.

## Verification

Every draw can be independently verified by:

1. **Reviewing the audit bundle** - Complete JSON with all data
2. **Checking randomness source** - Links provided to verify randomness
3. **Running the draw yourself** - Use the same inputs with our open-source worker
4. **Comparing results** - Results should match exactly

## Draw Worker

Source code: https://github.com/vaultplay-dev/vaultplay-draw-worker

## Questions?

Open an issue or visit https://vaultplay.co.uk
```

## Step 2: Generate GitHub Token

### 2.1 Create Fine-Grained Personal Access Token

1. Go to GitHub → Settings (your profile)
2. Developer settings → Personal access tokens → Fine-grained tokens
3. Click "Generate new token"

### 2.2 Configure Token

**Token name:** `VaultPlay Draw Worker`

**Expiration:** 90 days (recommended - set calendar reminder to renew)

**Repository access:** 
- Select: "Only select repositories"
- Choose: `vaultplay-draw-history`

**Repository permissions:**
- Contents: **Read and write** ✓
- Metadata: **Read-only** (automatically selected)

All other permissions: Leave as "No access"

### 2.3 Generate and Copy Token

1. Click "Generate token"
2. **IMPORTANT:** Copy the token immediately (starts with `github_pat_`)
3. Store securely - you won't see it again
4. Set reminder to renew in 90 days

## Step 3: Configure Cloudflare Worker

### 3.1 Add Environment Variables

#### Option A: Via Cloudflare Dashboard (Easiest)

1. Go to Cloudflare Dashboard
2. Workers & Pages → Select your worker
3. Settings → Variables
4. Add environment variables:

**Secret (encrypted):**
- Name: `GITHUB_TOKEN`
- Value: `github_pat_...` (your token)
- Click "Encrypt"

**Plain text:**
- Name: `GITHUB_REPO_OWNER`
- Value: `vaultplay-dev` (or your GitHub username)

- Name: `GITHUB_REPO_NAME`
- Value: `vaultplay-draw-history`

- Name: `GITHUB_BRANCH`
- Value: `main`

5. Click "Save and deploy"

#### Option B: Via Wrangler CLI

```bash
# Set secret (encrypted)
wrangler secret put GITHUB_TOKEN --env production
# Paste your token when prompted

# Set plain variables in wrangler.toml
```

Add to `wrangler.toml`:
```toml
[env.production.vars]
GITHUB_REPO_OWNER = "vaultplay-dev"
GITHUB_REPO_NAME = "vaultplay-draw-history"
GITHUB_BRANCH = "main"
```

Then deploy:
```bash
wrangler deploy --env production
```

## Step 4: Test the Integration

### 4.1 Test Draw Request

```bash
curl -X POST https://draw.vaultplay.co.uk/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "randomness": "abc123def456",
    "entries": [
      {"entryCode": "TEST-001"},
      {"entryCode": "TEST-002"},
      {"entryCode": "TEST-003"}
    ],
    "competition": {
      "id": "TEST-2025-001",
      "name": "Test Draw",
      "mode": "test"
    },
    "randomnessSource": {
      "provider": "test",
      "timestamp": "2025-01-15T14:00:00Z"
    }
  }'
```

### 4.2 Verify Success

Check the response:
```json
{
  "success": true,
  "audit": {
    "github": {
      "published": true,
      "commitUrl": "https://github.com/.../commit/...",
      "filePath": "test/2025-01/test-draw/draw.json"
    }
  }
}
```

### 4.3 Check GitHub Repository

1. Go to your repository: `https://github.com/vaultplay-dev/vaultplay-draw-history`
2. Navigate to `test/2025-01/test-draw/`
3. You should see `draw.json`
4. View the commit - should show the worker's commit message

## Step 5: Test Live Draw (Creates Release)

```bash
curl -X POST https://draw.vaultplay.co.uk/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "randomness": "def789ghi012",
    "entries": [
      {"entryCode": "LIVE-001"},
      {"entryCode": "LIVE-002"}
    ],
    "competition": {
      "id": "LIVE-TEST-2025-001",
      "name": "Live Test Draw",
      "mode": "live"
    },
    "randomnessSource": {
      "provider": "test",
      "timestamp": "2025-01-15T14:05:00Z"
    }
  }'
```

Check for:
1. Commit in `/live/2025-01/live-test-draw/`
2. GitHub release created: `https://github.com/vaultplay-dev/vaultplay-draw-history/releases`
3. Release tag: `draw-live-test-draw-2025-01-15`

## Troubleshooting

### Issue: "GitHub token not configured"

**Solution:** Token wasn't added as environment variable. Check:
```bash
wrangler secret list --env production
```
Should show `GITHUB_TOKEN` in the list.

### Issue: "GitHub API error: 404"

**Possible causes:**
- Repository name is wrong
- Repository doesn't exist
- Token doesn't have access to repository

**Solution:** 
1. Check repository exists and is spelled correctly
2. Verify token has access to that specific repository

### Issue: "GitHub API error: 403 Forbidden"

**Possible causes:**
- Token expired
- Token lacks permissions
- Rate limit exceeded (unlikely with 2-5 draws/week)

**Solution:**
1. Check token expiration date
2. Regenerate token with correct permissions
3. Update worker secret

### Issue: Draw succeeds but GitHub publishing fails

**This is normal behavior!** The draw completes successfully and returns:
```json
{
  "success": true,
  "audit": {
    "github": {
      "published": false,
      "error": "...",
      "retryable": true
    }
  }
}
```

The complete audit bundle is included in the response. You can:
1. Copy the bundle from the response
2. Or check Cloudflare Worker logs
3. Manually commit to GitHub when issue is resolved

### Issue: "rate limit exceeded"

Very unlikely with typical usage, but if it happens:
- Wait 1 hour (rate limit resets)
- Check if something is calling your worker repeatedly
- Consider upgrading to GitHub Pro for higher limits (5000/hour vs 60/hour)

## Security Best Practices

### Token Security

✅ **DO:**
- Use fine-grained tokens (not classic PATs)
- Set expiration dates
- Limit to specific repository only
- Store as encrypted secret in Cloudflare
- Set calendar reminders to rotate

❌ **DON'T:**
- Commit tokens to code
- Use classic Personal Access Tokens
- Give broader permissions than needed
- Share tokens
- Use tokens without expiration

### Token Rotation

Every 90 days:
1. Generate new token (same permissions)
2. Update Cloudflare secret: `wrangler secret put GITHUB_TOKEN`
3. Test with a test draw
4. Delete old token from GitHub

### Monitoring

Regularly check:
- GitHub commits are appearing
- Releases are being created for live draws
- No failed draws in worker logs
- Token hasn't expired

## Advanced Configuration

### Custom Repository Structure

To change folder structure, modify in worker code:

```javascript
const filePath = `${folder}/${yearMonth}/${slug}/draw.json`;
```

### Different Repository Per Environment

```toml
[env.production.vars]
GITHUB_REPO_NAME = "vaultplay-draw-history"

[env.staging.vars]
GITHUB_REPO_NAME = "vaultplay-draw-history-staging"
```

### Disable GitHub Publishing

Simply don't provide `competition` metadata in the request:

```json
{
  "randomness": "...",
  "entries": [...]
  // No competition field = no GitHub publishing
}
```

## Maintenance

### Monthly Tasks
- Check repository is receiving draws
- Verify releases are being created
- Review any failed publishing attempts in logs

### Quarterly Tasks
- Rotate GitHub token (if using 90-day expiration)
- Review repository size (shouldn't be an issue with JSON files)
- Audit recent draws for completeness

### Annual Tasks
- Review and update README
- Archive old draws if repository gets large (>1GB)
- Update documentation

## Support

- Worker Issues: https://github.com/vaultplay-dev/vaultplay-draw-worker/issues
- Audit Repository: https://github.com/vaultplay-dev/vaultplay-draw-history
- VaultPlay: https://www.vaultplay.co.uk
