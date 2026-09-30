import { describe, expect, it } from 'vitest';
import { powerModifierValue, weaponDamage } from './weaponDamage';

describe('weapon damage', () => {
  const modifiers = { strength: 3, dexterity: 2, intelligence: 1, faith: 4, arcane: 5 };

  it('adds fullwidth numbers and each repeated stat modifier', () => {
    expect(powerModifierValue('５＋筋筋＋技', modifiers)).toBe(13);
    expect(powerModifierValue('筋技', modifiers)).toBe(5);
  });

  it('preserves posture stars and adds three damage per reinforcement level', () => {
    expect(weaponDamage('7★★', '４＋筋', 2, modifiers)).toBe('20★★');
  });

  it('keeps empty and unsupported base cells readable', () => {
    expect(weaponDamage('', '５', 1, modifiers)).toBe('—');
    expect(weaponDamage('特殊', '５', 1, modifiers)).toBe('特殊');
  });
});
