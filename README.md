# VaultPlay Draw Worker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/v/release/vaultplay-dev/vaultplay-draw-worker)](https://github.com/vaultplay-dev/vaultplay-draw-worker/releases)

A Cloudflare Worker implementation for transparent, verifiable, and deterministic prize draws. This system ensures fairness and reproducibility for all participants through cryptographic methods and public auditability.

## 🎯 Features

- **Cryptographically Secure**: Uses SHA-256 hashing for deterministic scoring
- **Publicly Auditable**: All draw results can be independently verified
- **Deterministic**: Same inputs always produce the same results
- **Transparent**: Open-source algorithm with comprehensive documentation
- **Production-Ready**: Input validation, rate limiting, CORS support
- **Zero Side Effects**: No external dependencies during draw calculation

## 🔒 Security Highlights

- Input validation and sanitization
- Protection against DoS attacks (max 1M entries)
- Rate limiting headers support
- CORS configuration for public access
- Deterministic output based on public entropy sources
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

4. Edit `wrangler.toml` and add:
   - Your Cloudflare Account ID (find it in your Cloudflare dashboard)
   - Your custom domain (if using one)

5. Deploy to Cloudflare Workers:
```bash
# Deploy to development
wrangler deploy --env development

# Deploy to production
wrangler deploy --env production
```

## 📖 Usage

### API Endpoint

**POST** `/startdraw`

**Health Check:** `GET /` or `GET /health` - Returns service status and version

### Request Format

```json
{
  "randomness": "dbd8372fa098b50dc58a4827e6f19ef08f5ceab89effaacf2d670e14594ba57f",
  "entries": [
    { "entryCode": "ENTRY-001" },
    { "entryCode": "ENTRY-002" },
    { "entryCode": "ENTRY-003" }
  ],
  "drawRound": "5475483"
}
```

#### Parameters

- **randomness** (required, string): Public randomness source (e.g., drand beacon, blockchain hash)
  - Must be a hexadecimal string (0-9, a-f, A-F)
  - Length: 1-1024 characters
  - Example: `"dbd8372fa098b50dc58a4827e6f19ef08f5ceab89effaacf2d670e14594ba57f"`
  
- **entries** (required, array): List of entries to include in the draw
  - Each entry must have an `entryCode` field (string, 1-256 characters)
  - Maximum 100,000 entries per draw
  - Entry codes must be unique
  - Whitespace is automatically trimmed from entry codes
  
- **drawRound** (optional, string or number): Identifier for this draw round
  - Maximum 64 characters
  - Example: `"12345"` or `12345`

### Response Format

```json
{
  "metadata": {
    "algorithm": "VaultPlay Draw v1.0",
    "hashFunction": "SHA-256",
    "drawRound": "5475483",
    "drawSeed": "a1b2c3d4...",
    "timestamp": "2025-10-05T20:00:00.000Z",
    "totalEntries": 3,
    "resultsChecksum": "f3e4d5c6b7a89012"
  },
  "results": [
    {
      "rank": 1,
      "entryCode": "ENTRY-002",
      "score": "98765432109876543210",
      "scoreHex": "a1b2c3..."
    },
    {
      "rank": 2,
      "entryCode": "ENTRY-001",
      "score": "87654321098765432109",
      "scoreHex": "b2c3d4..."
    },
    {
      "rank": 3,
      "entryCode": "ENTRY-003",
      "score": "76543210987654321098",
      "scoreHex": "c3d4e5..."
    }
  ],
  "topWinners": [...]
}
```

### Example Request

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
    "drawRound": "5475483"
  }'
```

**Health Check:**
```bash
curl https://draw.vaultplay.co.uk/health
```

## 🔍 Algorithm

The draw algorithm follows these steps:

1. **Generate Seed**: `seed = SHA-256(randomness)`
2. **Score Entries**: For each entry, `score = SHA-256(seed || entryCode)`
3. **Convert to Numeric Score**: The SHA-256 hash (64 hex characters) is interpreted as a hexadecimal number and converted to a BigInt for precise comparison
4. **Rank by Score**: Sort entries by their numeric scores in descending order - highest score wins rank 1
5. **Return Results**: Provide ranked results with full audit trail

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

// Step 4: All entries are sorted by their numeric scores
// Highest score = Rank 1 (winner)
```

The hexadecimal hash output is treated as a base-16 number and converted to decimal for precise numeric comparison. This ensures:
- Every entry gets a unique, unpredictable score
- Scores can be compared mathematically to determine ranking
- The process is fully deterministic and reproducible

### Why This Works

- **Deterministic**: Same inputs always produce identical results
- **Unpredictable**: Cannot predict ranking without knowing the randomness beforehand
- **Verifiable**: Anyone can reproduce the results with the same inputs
- **Fair**: All entries have equal probability before randomness is revealed
- **Collision-resistant**: SHA-256 makes it virtually impossible for two entries to have the same score

## 🧪 Testing

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

// 4. Verify the ranking by comparing numeric scores
// The entry with the highest numeric score gets rank 1
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

Steps:
1. Seed = SHA-256(`abc123`) = `6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090`
2. Score = SHA-256(`6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090ENTRY-001`)
3. Score (hex) = `a7f3e4d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4`
4. Score (decimal) = Convert hex to BigInt for comparison

## 🔧 Configuration

Edit `CONFIG` constants in the worker code:

```javascript
const CONFIG = {
  MAX_ENTRIES: 100000,            // Maximum entries per draw
  MAX_ENTRY_CODE_LENGTH: 256,     // Maximum entry code length
  MAX_RANDOMNESS_LENGTH: 1024,    // Maximum randomness length
  MAX_DRAW_ROUND_LENGTH: 64,      // Maximum draw round ID length
  ALGORITHM_VERSION: "VaultPlay Draw v1.1",
  HASH_ALGORITHM: "SHA-256"
};
```

### Security Features

- **Input Validation**: All inputs are validated and sanitized
- **Whitespace Trimming**: Entry codes and randomness are automatically trimmed
- **Hex-only Randomness**: Only accepts valid hexadecimal strings for randomness
- **Security Headers**: Includes X-Frame-Options, CSP, X-Content-Type-Options, etc.
- **Rate Limiting**: Configure in Cloudflare Dashboard (recommended: 100 req/min)
- **CORS**: Configurable origin restrictions

## 📊 Use Cases

- Prize drawings and giveaways
- Lottery systems
- Random selection processes
- Transparent allocation mechanisms
- Verifiable randomness applications

## 🛡️ Security Considerations

### Randomness Source

The security of this system depends on the quality of the randomness input:

- ✅ **Recommended**: Use public, verifiable randomness sources
  - [drand](https://drand.love/) - League of Entropy's distributed randomness beacon
  - Blockchain hashes (Bitcoin, Ethereum)
  - Public lottery draws
  
- ❌ **Not Recommended**: Self-generated or private randomness

### Audit Trail

All draws include:
- Complete input parameters
- Algorithm version
- Timestamp
- Results checksum
- Full ranking with cryptographic scores

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 VaultPlay

## 🙏 Acknowledgments

- Inspired by transparent lottery systems and public randomness beacons
- Built for the VaultPlay platform
- Uses Cloudflare Workers edge computing

## 📬 Contact

- Issues: [GitHub Issues](https://github.com/vaultplay-dev/vaultplay-draw-worker/issues)
- Website: [vaultplay.co.uk](https://www.vaultplay.co.uk)

## 🔗 Links

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [drand - Distributed Randomness](https://drand.love/)
- [SHA-256 Specification](https://en.wikipedia.org/wiki/SHA-2)

---

**Version 1.1.0** - Released October 2025

### Changelog

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
