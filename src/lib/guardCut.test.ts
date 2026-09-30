import { describe, expect, it } from 'vitest';
import { addGuardCutSymbol } from './guardCut';

describe('guard cut shortcuts', () => {
  it('adds squares before stars', () => {
    expect(addGuardCutSymbol('□□☆☆', '□')).toBe('□□□☆☆');
  });

  it('adds stars at the end', () => {
    expect(addGuardCutSymbol('□□☆☆', '☆')).toBe('□□☆☆☆');
  });

  it('starts from an empty value', () => {
    expect(addGuardCutSymbol('', '□')).toBe('□');
    expect(addGuardCutSymbol('', '☆')).toBe('☆');
  });

  it('does not rewrite invalid manually entered text', () => {
    expect(addGuardCutSymbol('☆□', '□')).toBe('☆□');
  });
});
