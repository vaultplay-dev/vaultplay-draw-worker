# VaultPlay Draw Worker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/v/release/vaultplay-dev/vaultplay-draw-worker)](https://github.com/vaultplay-dev/vaultplay-draw-worker/releases)

A Cloudflare Worker implementation for transparent, verifiable, and deterministic prize draws. This system ensures fairness and reproducibility for all participants through cryptographic methods and public auditability.

## 🎯 Features

- **Cryptographically Secure**: Uses SHA-256 hashing for deterministic scoring
- **Publicly Auditable**: All draw results can be independently verified
- **Deterministic**: Same inputs always produce the same results
- **Transparent**: Open-source algorithm with comprehensive documentation
- **Auto-Fetch Randomness**: Optional worker-side randomness fetching from drand (eliminates manipulation window)
- **Entry Disqualification**: Comprehensive tracking of qualified vs disqualified entries with full transparency
- **Rich Entry Metadata**: Support for gamertags, emails (hashed), locations, quiz responses, and timestamps
- **Production-Ready**: Input validation, rate limiting, CORS support, automated testing
- **Zero Side Effects**: No external dependencies during draw calculation

## 🔒 Security Highlights

- Input validation and sanitization
- Protection against DoS attacks (max 100K entries)
- Rate limiting headers support
- CORS configuration for public access
- Deterministic output based on public entropy sources
- Optional worker-fetched randomness (eliminates manipulation window)
- Email hashing for privacy (SHA-256)
- Automatic audit bundle publishing to GitHub
- Automated testing on deployment
- No randomness generation - uses external public randomness (e.g., drand, blockchain)

## 🚀 Quick Start

### Prerequisites

- [Cloudflare Workers](https://workers.cloudflare.com/) account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

### Installation

1. Clone this repository:
```bash
git clone https://github.com/vaultplay-dev/vaultplay-draw-worker.git
cd vaultplay-draw-worker
```

2. Install dependencies:
```bash
npm install
```

3. Configure your Cloudflare Worker:
```bash
cp wrangler.toml.example wrangler.toml
```

4. Edit `wrangler.toml` and configure:
   - Update `GITHUB_REPO_OWNER` to your GitHub username (if using audit publishing)
   - Update `GITHUB_REPO_NAME` if you named your repo differently
   - For manual deployment, add your Cloudflare Account ID

5. Deploy to Cloudflare Workers:
```bash
# Deploy to development (includes automated tests)
wrangler deploy --env development

# Deploy to production (includes automated tests)
wrangler deploy --env production
```

Automated tests run during deployment to verify:
- Basic draw functionality
- Input validation
- Randomness auto-fetch
- Entry disqualification logic
- Error handling

## 📖 Usage

### API Endpoint

**POST** `/startdraw`

**Health Check:** `GET /` or `GET /health` - Returns service status and version

### Request Format

#### Basic Draw (Manual Randomness)

```json
{
  "randomness": "dbd8372fa098b50dc58a4827e6f19ef08f5ceab89effaacf2d670e14594ba57f",
  "entries": [
    { "entryCode": "VP-TEST-001" },
    { "entryCode": "VP-TEST-002" },
    { "entryCode": "VP-TEST-003" }
  ],
  "drawRound": 5475483,
  "competition": {
    "id": "COMP-2025-001",
    "name": "January 2025 Prize Draw",
    "mode": "live"
  },
  "randomnessSource": {
    "provider": "drand",
    "round": 5475483,
    "timestamp": "2025-01-15T13:55:00Z",
    "verificationUrl": "https://api.drand.sh/public/5475483"
  }
}
```

#### Advanced Draw (Auto-Fetch Randomness + Rich Entry Data)

```json
{
  "entries": [
    {
      "entryCode": "VP-2025-001",
      "gamertag": "ProGamer123",
      "email": "user@example.com",
      "entryTimestamp": "2025-01-15T10:30:00Z",
      "location": {
        "country": "United Kingdom",
        "region": "England"
      },
      "quiz": {
        "question": "What year was VaultPlay founded?",
        "answerGiven": "2024",
        "answerCorrect": true
      }
    },
    {
      "entryCode": "VP-2025-002",
      "gamertag": "Player456",
      "email": "another@example.com",
      "quiz": {
        "question": "What year was VaultPlay founded?",
        "answerGiven": "2020",
        "answerCorrect": false
      }
    }
  ],
  "competition": {
    "id": "COMP-2025-001",
    "name": "January 2025 Prize Draw",
    "mode": "live"
  },
  "randomnessSource": {
    "autoFetch": true,
    "provider": "drand"
  }
}
```

#### Parameters

##### Required Fields

- **entries** (required, array): List of entries to include in the draw
  - Each entry must have an `entryCode` field (string, 1-256 characters)
  - Maximum 100,000 entries per draw
  - Entry codes must be unique
  - Whitespace is automatically trimmed from entry codes

##### Randomness Options (one required)

**Option 1: Manual Randomness**
- **randomness** (string): Public randomness source (e.g., drand beacon, blockchain hash)
  - Must be a hexadecimal string (0-9, a-f, A-F)
  - Length: 1-1024 characters
  - Example: `"dbd8372fa098b50dc58a4827e6f19ef08f5ceab89effaacf2d670e14594ba57f"`

**Option 2: Auto-Fetch Randomness** (New in v1.3)
- **randomnessSource.autoFetch** (boolean): Set to `true` to fetch randomness automatically
- **randomnessSource.provider** (string): Must be `"drand"` when using autoFetch
- Worker fetches latest randomness from drand, eliminating any manipulation window

##### Optional Entry Fields (New in v1.3)

Each entry can include:

- **gamertag** (string, max 100 chars): Player display name
- **email** (string, max 254 chars): Email address (automatically hashed with SHA-256 for privacy)
- **entryTimestamp** (string): ISO 8601 timestamp of when entry was submitted
- **location** (object): Geographic information
  - **country** (string, max 100 chars): Country name
  - **region** (string, max 100 chars): Region/state/province
- **quiz** (object): Quiz-based qualification
  - **question** (string, max 500 chars): Quiz question text
  - **answerGiven** (string, max 500 chars): User's answer
  - **answerCorrect** (boolean): Whether answer was correct (false = disqualified)

##### Optional Fields

- **drawRound** (optional, string or number): Identifier for this draw round
  - Maximum 64 characters
  - Accepts both strings and numbers
  - Auto-populated from drand round if using autoFetch
  - Example: `5475483` or `"5475483"`

- **competition** (optional, object): Competition metadata for audit bundle generation
  - **id** (required if competition provided): Unique competition identifier (max 128 chars)
  - **name** (required if competition provided): Human-readable competition name (max 256 chars)
  - **mode** (required if competition provided): Either `"live"` or `"test"`
  - If provided, enables automatic audit bundle publishing to GitHub

- **randomnessSource** (optional, object): Metadata about randomness source for audit trail
  - **autoFetch** (boolean): Set to true to fetch randomness from worker (New in v1.3)
  - **provider** (string): Source name (e.g., "drand", "bitcoin")
  - **round** (string/number): Round/block number
  - **timestamp** (string): ISO 8601 timestamp of randomness generation
  - **verificationUrl** (string): URL to verify randomness independently

### Response Format

```json
{
  "success": true,
  "draw": {
    "timestamp": "2025-01-15T14:00:00.000Z",
    "mode": "live",
    "competitionId": "COMP-2025-001",
    "competitionName": "January 2025 Prize Draw",
    "totalEntries": 3,
    "qualifiedEntries": 2,
    "disqualifiedEntries": 1,
    "winner": {
      "rank": 1,
      "entryCode": "VP-2025-001",
      "gamertag": "ProGamer123",
      "score": "98765432109876543210",
      "scoreHex": "a1b2c3..."
    }
  },
  "audit": {
    "bundle": {
      "version": "1.0",
      "competition": { "id": "...", "name": "...", "mode": "live" },
      "draw": { "timestamp": "...", "workerVersion": "VaultPlay Draw v1.3" },
      "randomness": { 
        "value": "...", 
        "source": "drand",
        "fetchedByWorker": true,
        "round": 5475483,
        "timestamp": "2025-01-15T13:55:00Z",
        "verificationUrl": "https://api.drand.sh/public/5475483"
      },
      "entries": { 
        "total": 3,
        "qualified": 2,
        "disqualified": 1,
        "list": [
          {
            "entryCode": "VP-2025-001",
            "rank": 1,
            "gamertag": "ProGamer123",
            "emailHash": "5e884898da...",
            "entryTimestamp": "2025-01-15T10:30:00Z",
            "location": {
              "country": "United Kingdom",
              "region": "England"
            },
            "quiz": {
              "question": "What year was VaultPlay founded?",
              "answerGiven": "2024",
              "answerCorrect": true
            },
            "status": "qualified",
            "disqualificationReason": null
          },
          {
            "entryCode": "VP-2025-002",
            "rank": null,
            "gamertag": "Player456",
            "emailHash": "a3f5e9c21b...",
            "quiz": {
              "question": "What year was VaultPlay founded?",
              "answerGiven": "2020",
              "answerCorrect": false
            },
            "status": "disqualified",
            "disqualificationReason": "Quiz answered incorrectly"
          }
        ]
      },
      "statistics": {
        "disqualificationReasons": {
          "Quiz answered incorrectly": 1
        },
        "locationDistribution": {
          "countries": {
            "United Kingdom": 2
          },
          "regions": {
            "England": 2
          }
        }
      },
      "results": { "winner": {...}, "fullRanking": [...] },
      "verification": { ... },
      "bundleHash": "sha256-hash-of-bundle",
      "publication": { "publishedAt": "...", "filePath": "..." }
    },
    "bundleHash": "a1b2c3d4e5f6...",
    "github": {
      "published": true,
      "commitUrl": "https://github.com/vaultplay-dev/vaultplay-draw-history/commit/abc123",
      "commitSha": "abc123...",
      "releaseUrl": "https://github.com/vaultplay-dev/vaultplay-draw-history/releases/tag/draw-january-2025-prize-2025-01-15",
      "releaseTag": "draw-january-2025-prize-2025-01-15",
      "filePath": "live/2025-01/january-2025-prize-draw/draw.json"
    }
  },
  "metadata": {
    "algorithm": "VaultPlay Draw v1.3",
    "hashFunction": "SHA-256",
    "drawRound": "5475483",
    "drawSeed": "a1b2c3...",
    "timestamp": "2025-01-15T14:00:00.000Z",
    "totalEntries": 3,
    "qualifiedEntries": 2,
    "disqualifiedEntries": 1,
    "resultsChecksum": "f3e4d5c6b7a89012"
  },
  "results": [
    {
      "rank": 1,
      "entryCode": "VP-2025-001",
      "gamertag": "ProGamer123",
      "emailHash": "5e884898da...",
      "entryTimestamp": "2025-01-15T10:30:00Z",
      "location": {
        "country": "United Kingdom",
        "region": "England"
      },
      "quiz": {
        "question": "What year was VaultPlay founded?",
        "answerGiven": "2024",
        "answerCorrect": true
      },
      "status": "qualified",
      "disqualificationReason": null,
      "score": "98765432109876543210",
      "scoreHex": "a1b2c3..."
    },
    {
      "rank": null,
      "entryCode": "VP-2025-002",
      "gamertag": "Player456",
      "emailHash": "a3f5e9c21b...",
      "quiz": {
        "question": "What year was VaultPlay founded?",
        "answerGiven": "2020",
        "answerCorrect": false
      },
      "status": "disqualified",
      "disqualificationReason": "Quiz answered incorrectly",
      "score": "87654321098765432109",
      "scoreHex": "b2c3d4..."
    }
  ],
  "topWinners": [...]
}
```

### Example Requests

#### Basic Draw with Manual Randomness

```bash
curl -X POST https://draw.vaultplay.co.uk/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "randomness": "dbd8372fa098b50dc58a4827e6f19ef08f5ceab89effaacf2d670e14594ba57f",
    "entries": [
      { "entryCode": "ENTRY-001" },
      { "entryCode": "ENTRY-002" },
      { "entryCode": "ENTRY-003" }
    ],
    "drawRound": 5475483,
    "competition": {
      "id": "COMP-2025-001",
      "name": "January 2025 Prize Draw",
      "mode": "live"
    },
    "randomnessSource": {
      "provider": "drand",
      "round": 5475483,
      "timestamp": "2025-01-15T13:55:00Z",
      "verificationUrl": "https://api.drand.sh/public/5475483"
    }
  }'
```

#### Advanced Draw with Auto-Fetch Randomness

```bash
curl -X POST https://draw.vaultplay.co.uk/startdraw \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {
        "entryCode": "VP-2025-001",
        "gamertag": "ProGamer123",
        "email": "user@example.com",
        "location": {
          "country": "United Kingdom"
        }
      },
      {
        "entryCode": "VP-2025-002",
        "gamertag": "Player456",
        "quiz": {
          "question": "What is 2+2?",
          "answerGiven": "5",
          "answerCorrect": false
        }
      }
    ],
    "competition": {
      "id": "COMP-2025-001",
      "name": "January 2025 Prize Draw",
      "mode": "live"
    },
    "randomnessSource": {
      "autoFetch": true,
      "provider": "drand"
    }
  }'
```

**Health Check:**
```bash
curl https://draw.vaultplay.co.uk/health
```

## 🔍 Algorithm

The draw algorithm follows these steps:

1. **Obtain Randomness**: Either use provided randomness OR fetch automatically from drand (v1.3+)
2. **Generate Seed**: `seed = SHA-256(randomness)`
3. **Process Entries**: Hash emails for privacy, determine qualification status
4. **Score Entries**: For each entry, `score = SHA-256(seed || entryCode)`
5. **Filter Entries**: Separate qualified from disqualified entries
6. **Convert to Numeric Score**: The SHA-256 hash (64 hex characters) is interpreted as a hexadecimal number and converted to a BigInt for precise comparison
7. **Rank Qualified Entries**: Sort qualified entries by their numeric scores in descending order - highest score wins rank 1
8. **Return Results**: Qualified entries with ranks, disqualified entries without ranks, plus full audit trail

### Entry Disqualification (New in v1.3)

Entries can be disqualified based on:
- **Quiz Answers**: If `quiz.answerCorrect = false`, entry is automatically disqualified
- **Future Extensions**: System supports adding more disqualification criteria

Disqualified entries:
- Are included in results with `rank: null`
- Have `status: "disqualified"`
- Include `disqualificationReason` explaining why
- Do not compete for prizes
- Are tracked in audit bundle statistics

### How Scoring Works in Detail

Each entry receives a deterministic score through this process:

```javascript
// Step 1: Generate the draw seed from randomness
seed = SHA-256("dbd8372fa098b50dc58a4827e6f19ef08f5ceab89effaacf2d670e14594ba57f")
// Result: "a1b2c3d4..." (64 hex characters)

// Step 2: Score each entry by hashing seed + entryCode
scoreHex = SHA-256(seed + "ENTRY-001")
// Result: "f3e4d5c6b7a89012..." (64 hex characters)

// Step 3: Convert hex to decimal number for comparison
score = BigInt("0x" + scoreHex)
// Result: 112233445566778899... (very large integer)

// Step 4: Filter entries by qualification status
qualifiedEntries = entries.filter(e => e.status === "qualified")
disqualifiedEntries = entries.filter(e => e.status === "disqualified")

// Step 5: All qualified entries are sorted by their numeric scores
// Highest score = Rank 1 (winner)
// Disqualified entries have rank = null
```

The hexadecimal hash output is treated as a base-16 number and converted to decimal for precise numeric comparison. This ensures:
- Every entry gets a unique, unpredictable score
- Scores can be compared mathematically to determine ranking
- The process is fully deterministic and reproducible
- Only qualified entries compete for rankings

### Why This Works

- **Deterministic**: Same inputs always produce identical results
- **Unpredictable**: Cannot predict ranking without knowing the randomness beforehand
- **Verifiable**: Anyone can reproduce the results with the same inputs
- **Fair**: All qualified entries have equal probability before randomness is revealed
- **Transparent**: Disqualified entries are clearly marked with reasons
- **Collision-resistant**: SHA-256 makes it virtually impossible for two entries to have the same score
- **Privacy-Preserving**: Emails are hashed, never stored in plaintext

## 🧪 Testing

### Automated Testing

The deployment process includes automated tests that verify:
- ✅ Basic draw functionality
- ✅ Input validation and sanitization
- ✅ Auto-fetch randomness from drand
- ✅ Entry disqualification logic
- ✅ Email hashing
- ✅ Quiz-based qualification
- ✅ Error handling
- ✅ Health check endpoint

Tests run automatically on every deployment to both development and production environments.

### Manual Verification

You can verify draws independently using any SHA-256 implementation:

```javascript
// Example verification in JavaScript:

// 1. Verify the seed generation
const seed = SHA256("your-randomness-input");
console.log("Seed:", seed);

// 2. Verify any entry's score
const scoreHex = SHA256(seed + "ENTRY-001");
console.log("Score (hex):", scoreHex);

// 3. Convert to numeric value for ranking
const scoreDecimal = BigInt("0x" + scoreHex);
console.log("Score (decimal):", scoreDecimal.toString());

// 4. Verify email hashing
const emailHash = SHA256("user@example.com");
console.log("Email hash:", emailHash);

// 5. Verify the ranking by comparing numeric scores
// The entry with the highest numeric score gets rank 1
// Disqualified entries have rank = null
```

### Online Verification Tools

You can manually verify draws using:
- [SHA-256 Hash Generator](https://emn178.github.io/online-tools/sha256.html)
- Any programming language's crypto library (Python, Node.js, etc.)
- Command line: `echo -n "input" | shasum -a 256`

### Example Verification

Given:
- Randomness: `abc123`
- Entry: `ENTRY-001`
- Email: `user@example.com`

Steps:
1. Seed = SHA-256(`abc123`) = `6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090`
2. Score = SHA-256(`6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090ENTRY-001`)
3. Score (hex) = `a7f3e4d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4`
4. Score (decimal) = Convert hex to BigInt for comparison
5. Email Hash = SHA-256(`user@example.com`) = `5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8`

## 🔧 Configuration

### Worker Configuration

Edit `CONFIG` constants in the worker code:

```javascript
const CONFIG = {
  MAX_ENTRIES: 100000,              // Maximum entries per draw
  MAX_ENTRY_CODE_LENGTH: 256,       // Maximum entry code length
  MAX_RANDOMNESS_LENGTH: 1024,      // Maximum randomness length
  MAX_DRAW_ROUND_LENGTH: 64,        // Maximum draw round ID length
  MAX_COMPETITION_NAME_LENGTH: 256, // Maximum competition name length
  MAX_COMPETITION_ID_LENGTH: 128,   // Maximum competition ID length
  MAX_GAMERTAG_LENGTH: 100,         // Maximum gamertag length
  MAX_EMAIL_LENGTH: 254,            // Maximum email length (RFC 5321)
  MAX_LOCATION_LENGTH: 100,         // Maximum country/region length
  MAX_QUIZ_FIELD_LENGTH: 500,       // Maximum quiz question/answer length
  ALGORITHM_VERSION: "VaultPlay Draw v1.3",
  HASH_ALGORITHM: "SHA-256",
  DRAND_API_URL: "https://api.drand.sh/public/latest"
};
```

### Environment Variables

For automatic audit bundle publishing to GitHub, configure these environment variables in Cloudflare:

**Required for GitHub Publishing:**
- `GITHUB_TOKEN` - GitHub Personal Access Token (fine-grained recommended)
  - Permissions needed: Contents (read & write)
  - Set via: `wrangler secret put GITHUB_TOKEN --env production`
  - Or via Cloudflare Dashboard: Workers & Pages → Settings → Variables

**Optional (defaults provided):**
- `GITHUB_REPO_OWNER` - Repository owner (default: "vaultplay-dev")
- `GITHUB_REPO_NAME` - Repository name (default: "vaultplay-draw-history")
- `GITHUB_BRANCH` - Branch name (default: "main")

Set via `wrangler.toml`:
```toml
[env.production.vars]
GITHUB_REPO_OWNER = "your-github-username"
GITHUB_REPO_NAME = "your-audit-repo"
GITHUB_BRANCH = "main"
```

### GitHub Token Setup

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click "Generate new token"
3. Configure:
   - **Token name:** VaultPlay Draw Worker
   - **Expiration:** 90 days (set calendar reminder)
   - **Repository access:** Only select repositories → choose your audit repository
   - **Permissions:**
     - Contents: Read and write ✓
     - Metadata: Read-only ✓ (automatically selected)
4. Generate and copy the token
5. Add to Cloudflare Worker:
   ```bash
   wrangler secret put GITHUB_TOKEN --env production
   ```

### Security Features

- **Input Validation**: All inputs are validated and sanitized
- **Whitespace Trimming**: Entry codes and randomness are automatically trimmed
- **Hex-only Randomness**: Only accepts valid hexadecimal strings for randomness
- **Email Privacy**: Emails are hashed with SHA-256, never stored in plaintext
- **Auto-Fetch Randomness**: Eliminates manipulation window by fetching randomness server-side
- **Security Headers**: Includes X-Frame-Options, CSP, X-Content-Type-Options, etc.
- **Rate Limiting**: Configure in Cloudflare Dashboard (recommended: 100 req/min)
- **CORS**: Configurable origin restrictions
- **Automated Testing**: Continuous validation of functionality on every deployment
- **Graceful Degradation**: Draw succeeds even if GitHub publishing fails

## 📦 Audit Bundle & Public Verification

When competition metadata is provided, the worker automatically:
1. Generates a complete audit bundle containing all draw data
2. Commits the bundle to a GitHub repository (configurable)
3. Creates a public release for live draws
4. Returns GitHub URLs in the response

### Audit Bundle Structure

The audit bundle is a comprehensive JSON file containing:
- Competition metadata (ID, name, mode)
- Complete randomness source information (including `fetchedByWorker` flag)
- All entries with qualification status and disqualification reasons
- Entry metadata (gamertags, email hashes, locations, quiz responses)
- Statistics on disqualifications and location distribution
- Full verification data
- Bundle hash for integrity checking

### Public Audit Repository

All draws are published to a public GitHub repository for transparency:
- **Live draws:** Published in `/live/YYYY-MM/competition-name/` with public releases
- **Test draws:** Published in `/test/YYYY-MM/test-YYYY-MM-DD-###/` (commits only)

Example repository structure:
```
vaultplay-draw-history/
├── live/
│   └── 2025-01/
│       └── january-2025-prize-draw/
│           └── draw.json
└── test/
    └── 2025-01/
        └── test-2025-01-15-001/
            └── draw.json
```

### Why Test Draws Are Public

Test draws are published to demonstrate:
- Continuous system testing
- Nothing is hidden from public scrutiny
- Quality assurance processes
- Complete transparency

### Graceful Degradation

If GitHub publishing fails:
- ✅ Draw still succeeds and returns results
- ✅ Complete audit bundle is included in the API response
- ✅ Bundle can be manually published from worker logs
- ⚠️ Response indicates publication failure with error details

## 📊 Use Cases

- Prize drawings and giveaways with full audit trails
- Lottery systems with public verification
- Quiz-based competitions with automatic disqualification
- Random selection processes requiring transparency
- Transparent allocation mechanisms
- Verifiable randomness applications
- Competitions requiring regulatory compliance
- Geographic-based draws with location tracking
- Any draw requiring public trust and auditability

## 🛡️ Security Considerations

### Randomness Source

The security of this system depends on the quality of the randomness input:

- ✅ **Recommended**: Use public, verifiable randomness sources
  - [drand](https://drand.love/) - League of Entropy's distributed randomness beacon
    - **Best Practice**: Use `autoFetch: true` to eliminate manipulation window
  - Blockchain hashes (Bitcoin, Ethereum)
  - Public lottery draws
  
- ❌ **Not Recommended**: Self-generated or private randomness

### Auto-Fetch Randomness Benefits (v1.3)

When using `randomnessSource.autoFetch = true`:
- ✅ Worker fetches randomness at draw time
- ✅ Eliminates window for manipulation between randomness reveal and draw
- ✅ Randomness cannot be chosen to influence outcome
- ✅ Full transparency - fetch time and source recorded in audit bundle
- ✅ Automatic verification URL included

### Privacy Considerations

- **Email Hashing**: Emails are hashed with SHA-256 before storage
- **One-Way Function**: Original emails cannot be recovered from hashes
- **Verification**: Email owners can verify their entry by hashing their email
- **Transparency**: Email hashes are included in public audit bundles

### Audit Trail

All draws include:
- Complete input parameters
- Algorithm version
- Timestamp
- Randomness source metadata (including whether fetched by worker)
- Entry qualification status and disqualification reasons
- Statistics on disqualifications and locations
- Results checksum
- Full ranking with cryptographic scores

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

All pull requests trigger automated tests to ensure functionality.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 VaultPlay

## 🙏 Acknowledgments

- Inspired by transparent lottery systems and public randomness beacons
- Built for the VaultPlay platform
- Uses Cloudflare Workers edge computing
- [drand](https://drand.love/) for distributed randomness beacon

## 📬 Contact

- Issues: [GitHub Issues](https://github.com/vaultplay-dev/vaultplay-draw-worker/issues)
- Website: [vaultplay.co.uk](https://vaultplay.co.uk)

## 🔗 Links

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [drand - Distributed Randomness](https://drand.love/)
- [SHA-256 Specification](https://en.wikipedia.org/wiki/SHA-2)

---

**Version 1.3.0** - Released October 2025

### Changelog

**v1.3.0 (October 2025)**
- ✨ **Auto-Fetch Randomness**: Worker can now fetch randomness from drand automatically
  - Set `randomnessSource.autoFetch = true` to enable
  - Eliminates manipulation window between randomness reveal and draw
  - Automatic verification URL and timestamp included
- ✨ **Entry Disqualification System**: Comprehensive qualification tracking
  - Support for `status: "qualified"` or `"disqualified"`
  - Automatic disqualification based on quiz answers (`quiz.answerCorrect = false`)
  - Full transparency with `disqualificationReason` field
  - Statistics on disqualification reasons in audit bundle
- ✨ **Rich Entry Metadata**: Enhanced entry data support
  - `gamertag`: Player display name
  - `email`: Email address (automatically hashed with SHA-256 for privacy)
  - `entryTimestamp`: When entry was submitted
  - `location`: Country and region tracking
  - `quiz`: Question, answer, and correctness tracking
- 📊 **Enhanced Audit Bundles**:
  - Location distribution statistics (countries and regions)
  - Disqualification reason statistics
  - `fetchedByWorker` flag for randomness transparency
  - Separate counts for qualified vs disqualified entries
- 🎯 **Improved Results**:
  - Qualified entries ranked 1, 2, 3, etc.
  - Disqualified entries included with `rank: null`
  - Winner response includes gamertag if provided
  - Full metadata in results array
- 🧪 **Automated Testing**: Tests run on every deployment
  - Validates draw functionality
  - Tests auto-fetch randomness
  - Verifies disqualification logic
  - Ensures error handling works correctly
- 🔒 **Privacy Enhancement**: Email hashing for participant privacy
- 📏 **New Configuration Limits**:
  - `MAX_GAMERTAG_LENGTH: 100`
  - `MAX_EMAIL_LENGTH: 254`
  - `MAX_LOCATION_LENGTH: 100`
  - `MAX_QUIZ_FIELD_LENGTH: 500`

**v1.2.0 (October 2025)**
- Added automatic audit bundle generation and publishing
- Integrated GitHub repository publishing for complete transparency
- Audit bundles include competition metadata, randomness source, and full results
- Auto-create GitHub releases for live draws (commits only for test draws)
- Added winner extraction in response for easy access
- Enhanced response format with draw summary and audit information
- Support for environment-based GitHub configuration
- Graceful degradation - draw succeeds even if GitHub publishing fails
- Added competition and randomnessSource fields to request
- Complete end-to-end audit solution for transparency

**v1.1.0 (October 2025)**
- Added security headers (X-Frame-Options, CSP, etc.)
- Implemented proper SHA-256 for results checksum
- Added input sanitization (whitespace trimming)
- Enforced hexadecimal-only randomness validation
- Added health check endpoint (`/` and `/health`)
- Reduced MAX_ENTRIES to 100,000 for better performance
- Added request logging for monitoring
- Improved algorithm documentation with score derivation details

**v1.0.0 (October 2025)**
- Initial release
- Basic draw functionality with SHA-256 scoring
- CORS support
- Input validation
