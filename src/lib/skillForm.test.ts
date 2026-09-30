import { describe, expect, it } from 'vitest';
import { applyCostShortcut } from './skillForm';

describe('skill cost shortcuts', () => {
  it('inserts each initial token', () => {
    expect(applyCostShortcut('', 'dice')).toBe('ダイス１個');
    expect(applyCostShortcut('', 'sequence')).toBe('連番２個');
    expect(applyCostShortcut('', 'pair')).toBe('ゾロ２個');
    expect(applyCostShortcut('', 'fp')).toBe('FP■');
  });

  it('appends a different token with a full-width plus', () => {
    expect(applyCostShortcut('連番２個', 'fp')).toBe('連番２個＋FP■');
  });

  it('increments an existing token without changing the rest of the cost', () => {
    expect(applyCostShortcut('ダイス１個＋FP■', 'dice')).toBe('ダイス２個＋FP■');
    expect(applyCostShortcut('連番２個＋FP■', 'sequence')).toBe('連番３個＋FP■');
    expect(applyCostShortcut('ゾロ２個＋FP■', 'pair')).toBe('ゾロ３個＋FP■');
    expect(applyCostShortcut('連番２個＋FP■', 'fp')).toBe('連番２個＋FP■■');
  });
});
