export const adminKinds = ['episodes', 'special-items', 'origins', 'armors', 'armor-sets', 'weapons', 'weapon-categories', 'shields', 'shield-categories', 'talismans', 'skills', 'skill-sets', 'spirit-ashes'] as const;
export type AdminKind = typeof adminKinds[number];

export function adminKindForPath(path: string): AdminKind | null {
  const match = path.match(/^\/admin\/(episodes|special-items|origins|armors|armor-sets|weapons|weapon-categories|shields|shield-categories|talismans|skills|skill-sets|spirit-ashes)\/new$/);
  return match ? match[1] as AdminKind : null;
}
