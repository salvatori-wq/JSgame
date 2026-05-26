// Sprint pós-deploy — tests pra categorizeError pure.

import { describe, it, expect } from 'vitest';
import { categorizeError } from '../dm-error-breakdown';

describe('categorizeError', () => {
  it('429 → rate_limit', () => {
    expect(categorizeError('Error 429: Too Many Requests')).toBe('rate_limit');
    expect(categorizeError('rate limit exceeded')).toBe('rate_limit');
  });

  it('quota → quota_exceeded', () => {
    expect(categorizeError('Quota exceeded for the day')).toBe('quota_exceeded');
    expect(categorizeError('Daily limit reached')).toBe('quota_exceeded');
  });

  it('timeout → timeout', () => {
    expect(categorizeError('LLM timeout após 35000ms')).toBe('timeout');
    expect(categorizeError('Request timed out')).toBe('timeout');
  });

  it('JSON parse fail', () => {
    expect(categorizeError('Failed to parse JSON response')).toBe('parse_fail');
  });

  it('empty response special case', () => {
    expect(categorizeError('LLM retornou narração vazia')).toBe('empty_response');
    expect(categorizeError('empty narration after retry')).toBe('empty_response');
  });

  it('400 tools fail', () => {
    expect(categorizeError('400: Failed to call a function with name')).toBe('tools_400');
    expect(categorizeError('Tool malformed')).toBe('tools_400');
  });

  it('safety block', () => {
    expect(categorizeError('Response blocked by safety filter')).toBe('safety_block');
    expect(categorizeError('Content filtered for recitation')).toBe('safety_block');
  });

  it('auth fail', () => {
    expect(categorizeError('401 Unauthorized')).toBe('auth_fail');
    expect(categorizeError('Invalid API key')).toBe('auth_fail');
  });

  it('upstream 5xx', () => {
    expect(categorizeError('503 Service Unavailable')).toBe('upstream_5xx');
    expect(categorizeError('502 Bad Gateway from provider')).toBe('upstream_5xx');
    expect(categorizeError('Provider is overload')).toBe('upstream_5xx');
  });

  it('unknown fallback', () => {
    expect(categorizeError('Some random error')).toBe('unknown');
    expect(categorizeError('')).toBe('unknown');
  });

  it('case insensitive', () => {
    expect(categorizeError('RATE LIMIT')).toBe('rate_limit');
    expect(categorizeError('TimeOut')).toBe('timeout');
  });
});
