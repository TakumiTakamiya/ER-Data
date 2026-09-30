import { describe, expect, it } from 'vitest';
import { combinedCategoryOptions, combinedCategorySelection, splitCategorySelection } from './skillCategorySelection';

describe('combined skill category selection', () => {
  it('keeps overlapping weapon and shield IDs distinct', () => {
    expect(combinedCategoryOptions([{ id: 1, name: '直剣' }], [{ id: 1, name: '小盾' }])).toEqual([
      { id: 'weapon:1', name: '【武器】直剣' },
      { id: 'shield:1', name: '【盾】小盾' },
    ]);
  });

  it('sorts each category type by ID instead of name', () => {
    expect(combinedCategoryOptions(
      [{ id: 8, name: 'あいう' }, { id: 2, name: 'わをん' }],
      [{ id: 7, name: '小盾' }, { id: 1, name: '大盾' }],
    ).map((option) => option.id)).toEqual(['weapon:2', 'weapon:8', 'shield:1', 'shield:7']);
  });

  it('combines and splits selected IDs', () => {
    const selected = combinedCategorySelection([1, 3], [1, 2]);
    expect(splitCategorySelection(selected)).toEqual({ weaponCategoryIds: [1, 3], shieldCategoryIds: [1, 2] });
  });
});
