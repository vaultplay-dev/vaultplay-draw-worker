// Automated tests for VaultPlay Draw Worker
// Tests run in actual Cloudflare Workers runtime
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';

describe('VaultPlay Draw Worker - Input Validation', () => {
  it('returns error for missing randomness and autoFetch', async () => {
    const request = new Request('http://example.com/startdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [{ entryCode: 'A' }] })
    });
    
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/randomness/i);
  });

  it('returns error for empty entries', async () => {
    const request = new Request('http://example.com/startdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ randomness: 'deadbeef', entries: [] })
    });
    
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/entries/i);
  });

  it('returns error for invalid randomness hex', async () => {
    const request = new Request('http://example.com/startdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        randomness: 'nothex', 
        entries: [{ entryCode: 'A' }] 
      })
    });
    
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/hexadecimal/i);
  });

  it('returns error for duplicate entry codes', async () => {
    const request = new Request('http://example.com/startdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        randomness: 'a'.repeat(64),
        entries: [
          { entryCode: 'A' },
          { entryCode: 'A' }  // Duplicate
        ]
      })
    });
    
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/duplicate/i);
  });
});

describe('VaultPlay Draw Worker - Basic Draw Functionality', () => {
  it('performs draw with manual randomness', async () => {
    const request = new Request('http://example.com/startdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        randomness: 'a'.repeat(64),
        entries: [
          { entryCode: 'A' },
          { entryCode: 'B' },
          { entryCode: 'C' }
        ]
      })
    });
    
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.metadata.drawSeed).toHaveLength(64);
    expect(data.metadata.totalEntries).toBe(3);
    expect(data.results.length).toBe(3);
    expect(data.draw.winner).toBeDefined();
    expect(data.draw.winner.rank).toBe(1);
  });

  it('produces deterministic results with same inputs', async () => {
    const requestBody = {
      randomness: 'b'.repeat(64),
      entries: [
        { entryCode: 'X' },
        { entryCode: 'Y' },
        { entryCode: 'Z' }
      ]
    };

    // First draw
    const request1 = new Request('http://example.com/startdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const ctx1 = createExecutionContext();
    const response1 = await worker.fetch(request1, env, ctx1);
    await waitOnExecutionContext(ctx1);
    const data1 = await response1.json();

    // Second draw with same inputs
    const request2 = new Request('http://example.com/startdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const ctx2 = createExecutionContext();
    const response2 = await worker.fetch(request2, env, ctx2);
    await waitOnExecutionContext(ctx2);
    const data2 = await response2.json();

    // Results should be identical
    expect(data1.metadata.drawSeed).toBe(data2.metadata.drawSeed);
    expect(data1.results[0].entryCode).toBe(data2.results[0].entryCode);
    expect(data1.results[0].score).toBe(data2.results[0].score);
  });
});

describe('VaultPlay Draw Worker - Enhanced Entry Data', () => {
  it('handles entry with gamertag and location', async () => {
    const request = new Request('http://example.com/startdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        randomness: 'c'.repeat(64),
        entries: [
          {
            entryCode: 'VP-001',
            gamertag: 'TestPlayer',
            email: 'test@example.com',
            location: {
              country: 'GB',
              region: 'Hampshire'
            }
          }
        ]
      })
    });
    
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.results[0].gamertag).toBe('TestPlayer');
    expect(data.results[0].emailHash).toHaveLength(64);
    expect(data.results[0].location.country).toBe('GB');
    expect(data.results[0].location.region).toBe('Hampshire');
  });

  it('disqualifies entry with incorrect quiz answer', async () => {
    const request = new Request('http://example.com/startdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        randomness: 'd'.repeat(64),
        entries: [
          {
            entryCode: 'QUALIFIED',
            quiz: {
              question: 'Test question',
              answerGiven: 'Correct',
              answerCorrect: true
            }
          },
          {
            entryCode: 'DISQUALIFIED',
            quiz: {
              question: 'Test question',
              answerGiven: 'Wrong',
              answerCorrect: false
            }
          }
        ]
      })
    });
    
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.draw.qualifiedEntries).toBe(1);
    expect(data.draw.disqualifiedEntries).toBe(1);
    
    const qualified = data.results.find(r => r.entryCode === 'QUALIFIED');
    const disqualified = data.results.find(r => r.entryCode === 'DISQUALIFIED');
    
    expect(qualified.status).toBe('qualified');
    expect(qualified.rank).toBe(1);
    expect(disqualified.status).toBe('disqualified');
    expect(disqualified.rank).toBe(null);
    expect(disqualified.disqualificationReason).toBe('Quiz answered incorrectly');
  });
});

describe('VaultPlay Draw Worker - Health Check', () => {
  it('responds to health check endpoint', async () => {
    const request = new Request('http://example.com/health', {
      method: 'GET'
    });
    
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.version).toMatch(/VaultPlay Draw/);
  });
});
