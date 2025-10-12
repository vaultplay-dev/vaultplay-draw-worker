// Automated tests for VaultPlay Draw Worker
// Run with: npx jest __tests__/drawWorker.test.js

import handler from '../src/index.js';

// Helper to mock a fetch request
function makeRequest(body, method = 'POST') {
  return {
    method,
    headers: new Map([
      ['content-type', 'application/json']
    ]),
    json: async () => body
  };
}

describe('VaultPlay Draw Worker', () => {
  it('returns error for missing randomness and autoFetch', async () => {
    const req = makeRequest({ entries: [{ entryCode: 'A' }] });
    const res = await handler.fetch(req, {});
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/randomness/i);
  });

  it('returns error for empty entries', async () => {
    const req = makeRequest({ randomness: 'deadbeef', entries: [] });
    const res = await handler.fetch(req, {});
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/entries/i);
  });

  it('performs draw with manual randomness', async () => {
    const req = makeRequest({
      randomness: 'a'.repeat(64),
      entries: [
        { entryCode: 'A' },
        { entryCode: 'B' }
      ]
    });
    const res = await handler.fetch(req, {});
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.metadata.drawSeed).toHaveLength(64);
    expect(data.metadata.totalEntries).toBe(2);
    expect(data.results.length).toBe(2);
  });

  it('performs draw with drand autoFetch (mocked)', async () => {
    // Mock fetchDrandLatest to avoid real HTTP call
    const original = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ round: 12345, randomness: 'b'.repeat(64), signature: 'sig' })
    });
    const req = makeRequest({
      entries: [ { entryCode: 'A' } ],
      randomnessSource: { autoFetch: true, provider: 'drand' }
    });
    const res = await handler.fetch(req, {});
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.metadata.drawRound).toBe(12345);
    expect(data.metadata.drawSeed).toHaveLength(64);
    global.fetch = original;
  });

  it('returns error for invalid randomness hex', async () => {
    const req = makeRequest({ randomness: 'nothex', entries: [{ entryCode: 'A' }] });
    const res = await handler.fetch(req, {});
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/hexadecimal/i);
  });
});
