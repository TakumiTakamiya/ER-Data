export const weaponCategorySizes = ['小', '中', '大', '特'] as const;

export function withWeaponCategorySize(name: string, size: string): string {
  const baseName = name.trim().replace(/（[小中大特]）$/, '');
  return baseName && weaponCategorySizes.includes(size as (typeof weaponCategorySizes)[number])
    ? `${baseName}（${size}）`
    : baseName;
}
