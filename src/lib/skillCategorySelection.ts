import type { NamedOption } from './types';

export interface CombinedCategoryOption { id: string; name: string }

export function combinedCategoryOptions(weaponCategories: NamedOption[], shieldCategories: NamedOption[]): CombinedCategoryOption[] {
  return [
    ...[...weaponCategories].sort((a, b) => a.id - b.id).map((category) => ({ id: `weapon:${category.id}`, name: `【武器】${category.name}` })),
    ...[...shieldCategories].sort((a, b) => a.id - b.id).map((category) => ({ id: `shield:${category.id}`, name: `【盾】${category.name}` })),
  ];
}

export function combinedCategorySelection(weaponCategoryIds: number[], shieldCategoryIds: number[]): string[] {
  return [
    ...weaponCategoryIds.map((id) => `weapon:${id}`),
    ...shieldCategoryIds.map((id) => `shield:${id}`),
  ];
}

export function splitCategorySelection(ids: Array<string | number>): { weaponCategoryIds: number[]; shieldCategoryIds: number[] } {
  const weaponCategoryIds: number[] = [];
  const shieldCategoryIds: number[] = [];
  for (const value of ids) {
    const match = /^(weapon|shield):(\d+)$/.exec(String(value));
    if (!match) continue;
    const id = Number(match[2]);
    if (match[1] === 'weapon') weaponCategoryIds.push(id);
    else shieldCategoryIds.push(id);
  }
  return { weaponCategoryIds, shieldCategoryIds };
}
