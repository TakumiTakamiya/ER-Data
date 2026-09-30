import { describe, expect, it } from 'vitest';
import { cappedFlaskValue, goldenSeedIncrease, sacredTearIncrease } from './characterResources';

describe('goldenSeedIncrease', () => {
  it.each([[0,0],[4,0],[5,1],[10,1],[11,2],[17,2],[18,3],[25,3],[26,4],[35,4],[36,5]])('%i個で%i増加する', (quantity, expected) => {
    expect(goldenSeedIncrease(quantity)).toBe(expected);
  });
});

describe('sacredTearIncrease', () => {
  it.each([[0,0],[1,1],[2,1],[3,2],[5,2],[6,3],[8,3],[9,4],[11,4],[12,5]])('%i個で%i増加する', (quantity, expected) => {
    expect(sacredTearIncrease(quantity)).toBe(expected);
  });
});

it('聖杯瓶の値を0から10の範囲に収める', () => {
  expect(cappedFlaskValue(5, 4)).toBe(10);
  expect(cappedFlaskValue(0, -8)).toBe(0);
});
