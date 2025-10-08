/**
 * VaultPlay Draw Worker v1.1
 * ==========================
 * Cloudflare Worker for transparent, verifiable, and deterministic prize draws
 * 
 * This worker implements a cryptographically secure, publicly auditable drawing system
 * that ensures fairness and reproducibility for all participants.
 * 
 * Security Features:
 * - Input validation and sanitization
 * - Rate limiting headers support
 * - CORS configuration
 * - Deterministic output based on public entropy
 * - No side effects or external dependencies during draw calculation
 * 
 * Algorithm Overview:
 * 1. Accepts public randomness source (e.g., drand beacon, blockchain hash)
 * 2. Generates deterministic seed via SHA-256(randomness)
 * 3. Scores each entry via SHA-256(seed || entryCode)
 * 4. Ranks entries by score in descending order
 * 
 * @version 1.1
 * @license MIT
 * @audit This code is designed for public audit and verification
 */

// Configuration constants
const CONFIG = {
  MAX_ENTRIES: 100000,            // Maximum entries per draw (reduced for performance)
  MAX_ENTRY_CODE_LENGTH: 256,     // Maximum length for entry codes
  MAX_RANDOMNESS_LENGTH: 1024,    // Maximum length for randomness input
  MAX_DRAW_ROUND_LENGTH: 64,      // Maximum length for draw round identifier
  MAX_COMPETITION_NAME_LENGTH: 256, // Maximum length for competition name
  MAX_COMPETITION_ID_LENGTH: 128,   // Maximum length for competition ID
  ALGORITHM_VERSION: "VaultPlay Draw v1.2",
  HASH_ALGORITHM: "SHA-256"
};

// CORS headers for transparency and public access
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

// Security headers
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
};

export default {
  /**
   * Main request handler
   * @param {Request} request - Incoming HTTP request
   * @param {Object} env - Environment variables (GitHub token, repo config)
   * @returns {Response} JSON response with draw results or error
   */
  async fetch(request, env) {
    // Parse the URL to check the pathname
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(JSON.stringify({
        status: "healthy",
        service: "VaultPlay Draw Worker",
        version: CONFIG.ALGORITHM_VERSION,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...SECURITY_HEADERS
        }
      });
    }
    
    // Only allow /startdraw endpoint for draws
    if (url.pathname !== "/startdraw") {
      return createErrorResponse(
        `Endpoint not found. Please use POST /startdraw for draw operations.`,
        404
      );
    }

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          ...SECURITY_HEADERS
        }
      });
    }

    // Only accept POST requests for draw operations
    if (request.method !== "POST") {
      return createErrorResponse("Method Not Allowed. Only POST requests are accepted.", 405);
    }

    // Verify Content-Type header
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return createErrorResponse("Content-Type must be application/json", 400);
    }

    try {
      // Parse and validate request body
      const body = await parseRequestBody(request);
      const validationResult = validateInput(body);
      
      if (!validationResult.valid) {
        return createErrorResponse(validationResult.error, 400);
      }

      const { randomness, entries, drawRound, competition, randomnessSource } = body;
      
      const drawTimestamp = new Date().toISOString();

      // Log draw request (for monitoring/debugging)
      console.log(`Draw request: competition=${competition?.name || 'N/A'}, mode=${competition?.mode || 'N/A'}, entries=${entries.length}`);

      // Step 1: Generate deterministic seed from randomness
      // The seed serves as the foundation for all subsequent calculations
      const seed = await computeSHA256Hex(randomness);

      // Step 2: Calculate cryptographic score for each entry
      // Score = SHA-256(seed || entryCode)
      // This ensures each entry gets a unique, deterministic score
      const scoredEntries = await calculateEntryScores(seed, entries);

      // Step 3: Sort entries by score (highest to lowest)
      // Using BigInt comparison for cryptographic precision
      const rankedEntries = rankEntriesByScore(scoredEntries);

      // Step 4: Prepare audit-friendly response
      const response = await formatDrawResponse(rankedEntries, seed, drawRound);

      // Step 5: Generate complete audit bundle
      const auditBundle = generateAuditBundle(
        response,
        competition,
        randomness,
        randomnessSource,
        drawTimestamp
      );

      // Step 6: Compute bundle hash
      const bundleHash = await computeSHA256Hex(JSON.stringify(auditBundle));

      // Step 7: Attempt to publish to GitHub (if competition metadata provided)
      let githubResult = { published: false, reason: "No competition metadata provided" };
      
      if (competition && competition.id && competition.name) {
        try {
          githubResult = await publishToGitHub(
            auditBundle,
            bundleHash,
            competition,
            drawTimestamp,
            env
          );
        } catch (githubError) {
          console.error("GitHub publishing failed:", githubError);
          githubResult = {
            published: false,
            error: githubError.message,
            retryable: isRetryableError(githubError)
          };
        }
      }

      // Step 8: Extract winner for easy access
      const winner = rankedEntries[0];

      // Step 9: Return complete response
      return new Response(JSON.stringify({
        success: true,
        draw: {
          timestamp: drawTimestamp,
          mode: competition?.mode || "unspecified",
          competitionId: competition?.id || null,
          competitionName: competition?.name || null,
          totalEntries: rankedEntries.length,
          winner: {
            rank: winner.rank,
            entryCode: winner.entryCode,
            score: winner.score,
            scoreHex: winner.scoreHex
          }
        },
        audit: {
          bundle: auditBundle,
          bundleHash: bundleHash,
          github: githubResult
        },
        metadata: response.metadata,
        results: response.results,
        topWinners: response.topWinners
      }, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          ...CORS_HEADERS,
          ...SECURITY_HEADERS
        }
      });

    } catch (error) {
      // Log error for monitoring (in production, use proper logging service)
      console.error("Draw processing error:", error);
      
      // Return sanitized error message
      return createErrorResponse(
        "Internal server error occurred during draw processing",
        500
      );
    }
  }
};

/**
 * Parse request body with size limits
 * @param {Request} request - Incoming request
 * @returns {Promise<Object>} Parsed JSON body
 * @throws {Error} If body is too large or invalid JSON
 */
async function parseRequestBody(request) {
  // Check Content-Length to prevent large payload attacks
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
    throw new Error("Request body too large");
  }

  try {
    return await request.json();
  } catch (error) {
    throw new Error("Invalid JSON in request body");
  }
}

/**
 * Comprehensive input validation
 * @param {Object} body - Request body
 * @returns {Object} Validation result with {valid: boolean, error?: string}
 */
function validateInput(body) {
  // Check required fields existence
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { randomness, entries, drawRound, competition, randomnessSource } = body;

  // Validate randomness field
  if (!randomness || typeof randomness !== "string") {
    return { valid: false, error: "Field 'randomness' is required and must be a string" };
  }

  // Trim whitespace
  const trimmedRandomness = randomness.trim();
  
  if (trimmedRandomness.length === 0 || trimmedRandomness.length > CONFIG.MAX_RANDOMNESS_LENGTH) {
    return { 
      valid: false, 
      error: `Field 'randomness' must be between 1 and ${CONFIG.MAX_RANDOMNESS_LENGTH} characters` 
    };
  }

  // Validate hex format
  if (!/^[0-9a-fA-F]+$/.test(trimmedRandomness)) {
    return { valid: false, error: "Field 'randomness' must be a valid hexadecimal string" };
  }

  // Update body with trimmed value
  body.randomness = trimmedRandomness;

  // Validate entries array
  if (!Array.isArray(entries)) {
    return { valid: false, error: "Field 'entries' must be an array" };
  }

  if (entries.length === 0) {
    return { valid: false, error: "Field 'entries' must contain at least one entry" };
  }

  if (entries.length > CONFIG.MAX_ENTRIES) {
    return { 
      valid: false, 
      error: `Maximum ${CONFIG.MAX_ENTRIES} entries allowed per draw` 
    };
  }

  // Validate each entry structure and content
  const entryCodesSet = new Set();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    if (!entry || typeof entry !== "object") {
      return { valid: false, error: `Entry at index ${i} must be an object` };
    }

    if (!entry.entryCode || typeof entry.entryCode !== "string") {
      return { valid: false, error: `Entry at index ${i} must have a string 'entryCode' field` };
    }

    // Trim whitespace from entry codes
    entry.entryCode = entry.entryCode.trim();

    if (entry.entryCode.length === 0 || entry.entryCode.length > CONFIG.MAX_ENTRY_CODE_LENGTH) {
      return { 
        valid: false, 
        error: `Entry code at index ${i} must be between 1 and ${CONFIG.MAX_ENTRY_CODE_LENGTH} characters` 
      };
    }

    // Check for duplicate entry codes
    if (entryCodesSet.has(entry.entryCode)) {
      return { valid: false, error: `Duplicate entry code detected: "${entry.entryCode}"` };
    }
    entryCodesSet.add(entry.entryCode);
  }

  // Validate optional drawRound field
  if (drawRound !== undefined && drawRound !== null) {
    // Accept string or number, convert to string
    const drawRoundStr = typeof drawRound === "number" ? drawRound.toString() : drawRound;
    
    if (typeof drawRoundStr !== "string") {
      return { 
        valid: false, 
        error: `Field 'drawRound' must be a string or number` 
      };
    }
    if (drawRoundStr.length > CONFIG.MAX_DRAW_ROUND_LENGTH) {
      return { 
        valid: false, 
        error: `Field 'drawRound' must be maximum ${CONFIG.MAX_DRAW_ROUND_LENGTH} characters` 
      };
    }
    // Update the body object with string version
    body.drawRound = drawRoundStr;
  }

  // Validate optional competition field
  if (competition !== undefined && competition !== null) {
    if (typeof competition !== "object" || Array.isArray(competition)) {
      return { valid: false, error: "Field 'competition' must be an object" };
    }

    // Validate competition.id
    if (!competition.id || typeof competition.id !== "string") {
      return { valid: false, error: "Field 'competition.id' is required and must be a string" };
    }
    if (competition.id.trim().length === 0 || competition.id.length > CONFIG.MAX_COMPETITION_ID_LENGTH) {
      return { 
        valid: false, 
        error: `Field 'competition.id' must be between 1 and ${CONFIG.MAX_COMPETITION_ID_LENGTH} characters` 
      };
    }

    // Validate competition.name
    if (!competition.name || typeof competition.name !== "string") {
      return { valid: false, error: "Field 'competition.name' is required and must be a string" };
    }
    if (competition.name.trim().length === 0 || competition.name.length > CONFIG.MAX_COMPETITION_NAME_LENGTH) {
      return { 
        valid: false, 
        error: `Field 'competition.name' must be between 1 and ${CONFIG.MAX_COMPETITION_NAME_LENGTH} characters` 
      };
    }

    // Validate competition.mode
    if (!competition.mode || typeof competition.mode !== "string") {
      return { valid: false, error: "Field 'competition.mode' is required and must be a string" };
    }
    const validModes = ["live", "test"];
    if (!validModes.includes(competition.mode.toLowerCase())) {
      return { valid: false, error: `Field 'competition.mode' must be either 'live' or 'test'` };
    }

    // Trim and normalize
    competition.id = competition.id.trim();
    competition.name = competition.name.trim();
    competition.mode = competition.mode.toLowerCase();
  }

  // Validate optional randomnessSource field
  if (randomnessSource !== undefined && randomnessSource !== null) {
    if (typeof randomnessSource !== "object" || Array.isArray(randomnessSource)) {
      return { valid: false, error: "Field 'randomnessSource' must be an object" };
    }
    // Optional fields - just validate types if provided
    if (randomnessSource.provider && typeof randomnessSource.provider !== "string") {
      return { valid: false, error: "Field 'randomnessSource.provider' must be a string" };
    }
    if (randomnessSource.timestamp && typeof randomnessSource.timestamp !== "string") {
      return { valid: false, error: "Field 'randomnessSource.timestamp' must be a string" };
    }
    if (randomnessSource.verificationUrl && typeof randomnessSource.verificationUrl !== "string") {
      return { valid: false, error: "Field 'randomnessSource.verificationUrl' must be a string" };
    }
  }

  return { valid: true };
}

/**
 * Calculate cryptographic scores for all entries
 * @param {string} seed - Hex-encoded seed from randomness
 * @param {Array} entries - Array of entry objects
 * @returns {Promise<Array>} Array of entries with scores
 */
async function calculateEntryScores(seed, entries) {
  // Process entries in parallel for efficiency
  // Each score is deterministically derived from seed + entryCode
  const scoredEntries = await Promise.all(
    entries.map(async (entry) => {
      // Concatenate seed with entry code
      // This ensures each entry gets a unique input for hashing
      const combinedInput = seed + entry.entryCode;
      
      // Generate cryptographic score via SHA-256
      const scoreHex = await computeSHA256Hex(combinedInput);
      
      // Convert to BigInt for precise numerical comparison
      // Prefix with "0x" to indicate hexadecimal
      const score = BigInt("0x" + scoreHex);
      
      return {
        entryCode: entry.entryCode,
        score: score,
        // Store hex representation for audit trail
        scoreHex: scoreHex
      };
    })
  );

  return scoredEntries;
}

/**
 * Rank entries by their cryptographic score
 * @param {Array} scoredEntries - Entries with calculated scores
 * @returns {Array} Sorted entries with rank assignments
 */
function rankEntriesByScore(scoredEntries) {
  // Create a copy to avoid mutating input
  const entries = [...scoredEntries];
  
  // Sort by score in descending order (highest score = rank 1)
  // Using explicit BigInt comparison for safety and clarity
  entries.sort((a, b) => {
    if (a.score > b.score) return -1;  // a ranks higher
    if (a.score < b.score) return 1;   // b ranks higher
    // In the extremely rare case of identical scores,
    // use lexicographic ordering of entry codes for consistency
    return a.entryCode.localeCompare(b.entryCode);
  });

  // Assign sequential ranks
  return entries.map((entry, index) => ({
    rank: index + 1,
    entryCode: entry.entryCode,
    // Convert BigInt to string for JSON serialization
    score: entry.score.toString(),
    // Include hex representation for verification
    scoreHex: entry.scoreHex
  }));
}

/**
 * Format the final draw response with metadata
 * @param {Array} rankedEntries - Sorted and ranked entries
 * @param {string} seed - Draw seed (hex)
 * @param {string|null} drawRound - Optional round identifier
 * @returns {Promise<Object>} Formatted response object
 */
async function formatDrawResponse(rankedEntries, seed, drawRound) {
  return {
    // Draw metadata for audit trail
    metadata: {
      algorithm: CONFIG.ALGORITHM_VERSION,
      hashFunction: CONFIG.HASH_ALGORITHM,
      drawRound: drawRound || "UNSPECIFIED",
      drawSeed: seed,
      timestamp: new Date().toISOString(),
      totalEntries: rankedEntries.length,
      // Include checksum of results for integrity verification
      resultsChecksum: await computeResultsChecksum(rankedEntries)
    },
    
    // Full results array
    results: rankedEntries,
    
    // Top winners for convenience (first 10 or all if less)
    topWinners: rankedEntries.slice(0, Math.min(10, rankedEntries.length))
  };
}

/**
 * Compute a checksum of the results for integrity verification
 * Uses SHA-256 for cryptographic security
 * @param {Array} results - Ranked results array
 * @returns {Promise<string>} Hex checksum (first 16 characters)
 */
async function computeResultsChecksum(results) {
  // Create a deterministic string representation of results
  const resultsString = results
    .map(r => `${r.rank}:${r.entryCode}:${r.scoreHex}`)
    .join("|");
  
  // Compute full SHA-256 hash
  const fullHash = await computeSHA256Hex(resultsString);
  
  // Return first 16 chars as checksum
  return fullHash.substring(0, 16);
}

/**
 * Generate complete audit bundle for public verification
 * @param {Object} drawResponse - Draw response from formatDrawResponse
 * @param {Object} competition - Competition metadata
 * @param {string} randomness - Raw randomness value
 * @param {Object} randomnessSource - Randomness source metadata
 * @param {string} drawTimestamp - ISO timestamp of draw execution
 * @returns {Object} Complete audit bundle
 */
function generateAuditBundle(drawResponse, competition, randomness, randomnessSource, drawTimestamp) {
  return {
    version: "1.0",
    competition: competition ? {
      id: competition.id,
      name: competition.name,
      mode: competition.mode
    } : null,
    draw: {
      timestamp: drawTimestamp,
      workerVersion: CONFIG.ALGORITHM_VERSION,
      endpoint: "/startdraw"
    },
    randomness: {
      value: randomness,
      source: randomnessSource?.provider || "unspecified",
      round: randomnessSource?.round || drawResponse.metadata.drawRound,
      timestamp: randomnessSource?.timestamp || null,
      verificationUrl: randomnessSource?.verificationUrl || null
    },
    entries: {
      total: drawResponse.metadata.totalEntries,
      list: drawResponse.results.map(r => ({
        entryCode: r.entryCode,
        rank: r.rank
      }))
    },
    results: {
      winner: drawResponse.results[0],
      fullRanking: drawResponse.results,
      seed: drawResponse.metadata.drawSeed,
      checksum: drawResponse.metadata.resultsChecksum
    },
    verification: {
      algorithm: drawResponse.metadata.algorithm,
      hashFunction: drawResponse.metadata.hashFunction,
      sourceCode: "https://github.com/vaultplay-dev/vaultplay-draw-worker"
    }
  };
}

/**
 * Publish audit bundle to GitHub repository
 * @param {Object} auditBundle - Complete audit bundle
 * @param {string} bundleHash - SHA-256 hash of the bundle
 * @param {Object} competition - Competition metadata
 * @param {string} drawTimestamp - ISO timestamp
 * @param {Object} env - Environment variables
 * @returns {Promise<Object>} Publication result
 */
async function publishToGitHub(auditBundle, bundleHash, competition, drawTimestamp, env) {
  // Check for required environment variables
  if (!env.GITHUB_TOKEN) {
    return {
      published: false,
      error: "GitHub token not configured",
      retryable: false
    };
  }

  const repoOwner = env.GITHUB_REPO_OWNER || "vaultplay-dev";
  const repoName = env.GITHUB_REPO_NAME || "vaultplay-draw-history";
  const branch = env.GITHUB_BRANCH || "main";

  // Generate file path and slug
  const date = new Date(drawTimestamp);
  const yearMonth = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const slug = slugify(competition.name);
  const folder = competition.mode === "live" ? "live" : "test";
  const filePath = `${folder}/${yearMonth}/${slug}/draw.json`;

  // Add bundle hash and publication metadata to bundle
  auditBundle.bundleHash = bundleHash;
  auditBundle.publication = {
    publishedAt: new Date().toISOString(),
    filePath: filePath
  };

  try {
    // Commit file to GitHub
    const commitResult = await commitFileToGitHub(
      repoOwner,
      repoName,
      branch,
      filePath,
      auditBundle,
      competition,
      drawTimestamp,
      env.GITHUB_TOKEN
    );

    let releaseResult = null;

    // Create release only for live draws
    if (competition.mode === "live") {
      try {
        releaseResult = await createGitHubRelease(
          repoOwner,
          repoName,
          slug,
          competition,
          drawTimestamp,
          filePath,
          env.GITHUB_TOKEN
        );
      } catch (releaseError) {
        console.error("Release creation failed (non-fatal):", releaseError);
        // Don't fail the entire operation if only release fails
      }
    }

    return {
      published: true,
      commitUrl: commitResult.commitUrl,
      commitSha: commitResult.sha,
      releaseUrl: releaseResult?.releaseUrl || null,
      releaseTag: releaseResult?.tag || null,
      filePath: filePath
    };

  } catch (error) {
    throw error;
  }
}

/**
 * Commit a file to GitHub repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 * @param {string} path - File path
 * @param {Object} content - File content (will be JSON stringified)
 * @param {Object} competition - Competition metadata
 * @param {string} timestamp - Draw timestamp
 * @param {string} token - GitHub token
 * @returns {Promise<Object>} Commit result
 */
async function commitFileToGitHub(owner, repo, branch, path, content, competition, timestamp, token) {
  const apiBase = "https://api.github.com";
  
  // Encode content as base64
  const contentJson = JSON.stringify(content, null, 2);
  const contentBase64 = btoa(unescape(encodeURIComponent(contentJson)));

  // Check if file exists to get its SHA (required for updates)
  let existingFileSha = null;
  try {
    const checkResponse = await retryWithBackoff(async () => {
      const response = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "VaultPlay-Draw-Worker"
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.sha;
      }
      return null;
    });
    existingFileSha = checkResponse;
  } catch (error) {
    // File doesn't exist, that's fine for new draws
  }

  // Commit file
  const commitMessage = competition.mode === "live"
    ? `Draw audit bundle for ${competition.name} (${competition.id}) at ${timestamp}`
    : `Test draw audit bundle for ${competition.id} at ${timestamp} [mode: test]`;

  const commitPayload = {
    message: commitMessage,
    content: contentBase64,
    branch: branch
  };

  if (existingFileSha) {
    commitPayload.sha = existingFileSha;
  }

  const commitResponse = await retryWithBackoff(async () => {
    const response = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "VaultPlay-Draw-Worker"
      },
      body: JSON.stringify(commitPayload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message || response.statusText}`);
    }

    return response.json();
  });

  return {
    sha: commitResponse.content.sha,
    commitUrl: commitResponse.commit.html_url
  };
}

/**
 * Create a GitHub release for a live draw
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} slug - Competition slug for tag
 * @param {Object} competition - Competition metadata
 * @param {string} timestamp - Draw timestamp
 * @param {string} filePath - Path to audit bundle file
 * @param {string} token - GitHub token
 * @returns {Promise<Object>} Release result
 */
async function createGitHubRelease(owner, repo, slug, competition, timestamp, filePath, token) {
  const apiBase = "https://api.github.com";
  
  const tag = `draw-${slug}-${timestamp.split('T')[0]}`;
  const releaseTitle = `Draw results for ${competition.name}`;
  const releaseBody = `# ${competition.name}

**Competition ID:** ${competition.id}  
**Draw Date:** ${timestamp}  
**Mode:** ${competition.mode}  

## Audit Bundle

The complete audit bundle for this draw is available at:
[\`${filePath}\`](https://github.com/${owner}/${repo}/blob/main/${filePath})

## Verification

You can independently verify this draw by:
1. Viewing the audit bundle JSON file
2. Running the draw worker code with the same inputs
3. Comparing the results

**Draw Worker Source:** https://github.com/vaultplay-dev/vaultplay-draw-worker
`;

  const releasePayload = {
    tag_name: tag,
    name: releaseTitle,
    body: releaseBody,
    draft: false,
    prerelease: false
  };

  const releaseResponse = await retryWithBackoff(async () => {
    const response = await fetch(`${apiBase}/repos/${owner}/${repo}/releases`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "VaultPlay-Draw-Worker"
      },
      body: JSON.stringify(releasePayload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub release error: ${error.message || response.statusText}`);
    }

    return response.json();
  });

  return {
    releaseUrl: releaseResponse.html_url,
    tag: tag
  };
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of function
 */
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1 || !isRetryableError(error)) {
        throw error;
      }
      // Exponential backoff: 1s, 2s, 4s
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}

/**
 * Check if an error is retryable
 * @param {Error} error - Error object
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error) {
  const message = error.message || "";
  // Check for rate limits, timeouts, and temporary failures
  return message.includes("rate limit") ||
         message.includes("502") ||
         message.includes("503") ||
         message.includes("504") ||
         message.includes("timeout");
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert string to URL-safe slug
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, '-')  // Replace spaces, underscores with single hyphen
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Compute SHA-256 hash and return as hexadecimal string
 * @param {string} input - Input string to hash
 * @returns {Promise<string>} Hex-encoded hash (64 characters)
 */
async function computeSHA256Hex(input) {
  // Convert string to UTF-8 encoded bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  
  // Compute SHA-256 hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest(CONFIG.HASH_ALGORITHM, data);
  
  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexString = hashArray
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
  
  return hexString;
}

/**
 * Create a standardized error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response} Error response
 */
function createErrorResponse(message, status) {
  const errorBody = {
    error: true,
    message: message,
    timestamp: new Date().toISOString(),
    algorithm: CONFIG.ALGORITHM_VERSION
  };

  return new Response(JSON.stringify(errorBody, null, 2), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...CORS_HEADERS,
      ...SECURITY_HEADERS
    }
  });
}
