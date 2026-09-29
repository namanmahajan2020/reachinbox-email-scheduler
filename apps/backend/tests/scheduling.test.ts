import {describe,it,expect} from 'vitest';
import {emailIdempotencyKey,stableEmailJobId,uniqueRecipients} from '../src/services/scheduling.js';
import {parseLeads} from '../../frontend/src/utils/leads';

describe('email scheduling identifiers and lead normalization',()=>{
  it('removes duplicate addresses case-insensitively while preserving first spelling',()=>{
    expect(uniqueRecipients(['a@example.com',' B@example.com ','A@example.com','b@EXAMPLE.com']))
      .toEqual(['a@example.com','B@example.com']);
  });

  it('builds the same deterministic BullMQ job id for an email',()=>{
    expect(stableEmailJobId('email-123')).toBe('email-email-123');
    expect(stableEmailJobId('email-123')).toBe(stableEmailJobId('email-123'));
  });

  it('normalizes recipient casing for caller-provided idempotency keys',()=>{
    expect(emailIdempotencyKey('ignored',0,' User@Example.com ','campaign-request'))
      .toBe('campaign-request:user@example.com');
  });

  it('uses campaign and position to produce distinct default idempotency keys',()=>{
    expect(emailIdempotencyKey('campaign-a',0,'a@example.com'))
      .not.toBe(emailIdempotencyKey('campaign-a',1,'a@example.com'));
  });

  it('parses CSV/text leads, ignores headers/invalid cells, and removes duplicates',()=>{
    expect(parseLeads('name,email\nJohn,test1@example.com\nJane,test2@example.com\ntest1@example.com'))
      .toEqual(['test1@example.com','test2@example.com']);
  });
});
