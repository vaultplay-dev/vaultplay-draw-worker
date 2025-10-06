# VaultPlay Draw Worker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/vaultplay-draw-worker/releases/tag/v1.0.0)

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

**POST** `/`

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
  - Length: 1-1024 characters
  
- **entries** (required, array): List of entries to include in the draw
  - Each entry must have an `entryCode` field (string, 1-256 characters)
  - Maximum 1,000,000 entries per draw
  - Entry codes must be unique
  
- **drawRound** (optional, string or number): Identifier for this draw round
  - Maximum 64 characters

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
curl -X POST https://your-worker.workers.dev/startdraw \
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

## 🔍 Algorithm

The draw algorithm follows these steps:

1. **Generate Seed**: `seed = SHA-256(randomness)`
2. **Score Entries**: For each entry, `score = SHA-256(seed || entryCode)`
3. **Rank by Score**: Sort entries by score (descending), highest score wins
4. **Return Results**: Provide ranked results with full audit trail

### Why This Works

- **Deterministic**: Same inputs always produce identical results
- **Unpredictable**: Cannot predict ranking without knowing the randomness beforehand
- **Verifiable**: Anyone can reproduce the results with the same inputs
- **Fair**: All entries have equal probability before randomness is revealed

## 🧪 Testing

You can verify draws independently using any SHA-256 implementation:

```javascript
// Verify the seed
const seed = SHA256(randomness);

// Verify any entry's score
const score = SHA256(seed + entryCode);
```

## 🔧 Configuration

Edit `CONFIG` constants in the worker code:

```javascript
const CONFIG = {
  MAX_ENTRIES: 1000000,           // Maximum entries per draw
  MAX_ENTRY_CODE_LENGTH: 256,     // Maximum entry code length
  MAX_RANDOMNESS_LENGTH: 1024,    // Maximum randomness length
  MAX_DRAW_ROUND_LENGTH: 64,      // Maximum draw round ID length
  ALGORITHM_VERSION: "VaultPlay Draw v1.0",
  HASH_ALGORITHM: "SHA-256"
};
```

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
- Website: [vaultplay.co.uk](https://vaultplay.co.uk)

## 🔗 Links

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [drand - Distributed Randomness](https://drand.love/)
- [SHA-256 Specification](https://en.wikipedia.org/wiki/SHA-2)

---

**Version 1.0.0** - Released October 2025
