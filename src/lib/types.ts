export const abilityKeys = ['vigor', 'mind', 'endurance', 'strength', 'dexterity', 'intelligence', 'faith', 'arcane'] as const;
export type AbilityKey = typeof abilityKeys[number];
export type AbilityValues = Record<AbilityKey, number>;

export interface Adventure { id: number; name: string; memo: string; characterCount: number }
export type EpisodeStatus = 'LOCKED' | 'UNLOCKED' | 'COMPLETED';
export interface EpisodeProgress { id: number; name: string; episodeType: 'MAIN'|'SIDE'; episodeNumber: number; displayCode: string; maliceLevel: number; status: EpisodeStatus }
export interface SpecialItemQuantity extends NamedOption { quantity: number }
export interface AdventureInventory {
  weapons: number[]; shields: number[]; armors: number[]; talismans: number[]; skillSets: number[]; spiritAshes: number[];
}
export interface AdventureInventoryOptions {
  weapons: NamedOption[]; shields: NamedOption[]; armors: NamedOption[]; talismans: NamedOption[]; skillSets: NamedOption[]; spiritAshes: NamedOption[];
}
export interface AdventureDetail extends Adventure { episodes: EpisodeProgress[]; specialItems: SpecialItemQuantity[]; inventory: AdventureInventory; inventoryOptions: AdventureInventoryOptions }
export interface OriginSkill {
  id: number; name: string; classification: string; timing: string; target: string; cost: string; maxUses: number | null; rankEffects: string[];
}
export interface SkillDetail extends OriginSkill {
  weaponCategories: NamedOption[];
  shieldCategories: NamedOption[];
}
export interface OriginSkillSet { id: number; name: string; notes: string; skills: OriginSkill[] }
export interface Origin {
  id: number; name: string; initialLevel: number; initial: AbilityValues;
  skillSets: OriginSkillSet[]; weapons: NamedOption[]; shields: NamedOption[];
  armors: { head: NamedOption | null; body: NamedOption | null };
}
export interface CharacterSummary { id: number; name: string; level: number; adventureId: number; adventureName: string; originId: number; originName: string }
export interface CharacterDetail extends CharacterSummary {
  runes: number;
  materialPoints: number;
  abilities: Record<AbilityKey, { initial: number; growth: number; bonus: number; total: number }>;
}
export interface CharacterInput {
  name: string; adventureId: number; originId: number; level: number; runes: number; materialPoints: number;
  growth: AbilityValues; bonus: AbilityValues;
}
export interface NamedOption { id: number; name: string }
export interface ArmorSetSummary { id: number; name: string; seriesEffect: string; armorCount: number; skillCount: number }
export interface ArmorDetail {
  id: number; name: string; slot: 'HEAD' | 'BODY'; weight: number; physicalCut: number; phenomenonCut: number; poise: number;
  armorSet: NamedOption | null; skills: NamedOption[];
}
export interface TalismanDetail { id: number; name: string; effect: string }
export interface AdminOptions {
  skills: NamedOption[]; armorSets: NamedOption[]; weaponCategories: NamedOption[]; shieldCategories: NamedOption[];
  skillSets: NamedOption[]; armors: (NamedOption & { slot: 'HEAD' | 'BODY' })[]; weapons: NamedOption[]; shields: NamedOption[];
}
export interface ApiErrorBody { error: { code: string; message: string; fields?: Record<string, string> } }
