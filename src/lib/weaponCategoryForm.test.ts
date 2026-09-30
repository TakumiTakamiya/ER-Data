import { describe, expect, it } from 'vitest';
import { withWeaponCategorySize } from './weaponCategoryForm';

describe('weapon category size suffix', () => {
  it('appends a full-width size suffix', () => {
    expect(withWeaponCategorySize('直剣', '小')).toBe('直剣（小）');
  });

  it('replaces an existing size suffix', () => {
    expect(withWeaponCategorySize('直剣（小）', '中')).toBe('直剣（中）');
  });

  it('does not create a suffix without a category name', () => {
    expect(withWeaponCategorySize('', '大')).toBe('');
  });
});
