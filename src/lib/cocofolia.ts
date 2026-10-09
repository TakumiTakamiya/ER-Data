import { abilityKeys, type AbilityKey, type AbilityValues, type CharacterResources } from './types';

const abilityLabels: Record<AbilityKey, string> = {
  vigor: '生命力',
  mind: '精神力',
  endurance: '持久力',
  strength: '筋力',
  dexterity: '技量',
  intelligence: '知力',
  faith: '信仰',
  arcane: '神秘',
};

interface CocofoliaCharacterSource {
  name: string;
  abilities: AbilityValues;
  resources: CharacterResources;
  skills: { name: string; maxUses: number | null }[];
}

export interface CocofoliaCharacterClipboardData {
  kind: 'character';
  data: {
    name: string;
    status: { label: string; value: number; max: number }[];
    params: { label: string; value: string }[];
  };
}

export function buildCocofoliaCharacterData(source: CocofoliaCharacterSource): CocofoliaCharacterClipboardData {
  const hp = 5 + Math.floor(source.abilities.vigor / 4) + source.resources.maxHpModifier;
  const fp = 5 + Math.floor(source.abilities.mind / 4) + source.resources.maxFpModifier;
  const blessing = 5 + Math.floor(source.abilities.arcane / 4) + source.resources.maxBlessingModifier;
  const fullStatus = (label: string, value: number) => ({ label, value, max: value });

  return {
    kind: 'character',
    data: {
      name: source.name,
      status: [
        fullStatus('HP', hp),
        fullStatus('FP', fp),
        fullStatus('加護', blessing),
        fullStatus('緋聖杯', source.resources.crimsonFlaskAllocation),
        fullStatus('青聖杯', source.resources.ceruleanFlaskAllocation),
        ...source.skills
          .filter((skill): skill is { name: string; maxUses: number } => skill.maxUses !== null)
          .map((skill) => fullStatus(`${skill.name}使用回数`, skill.maxUses)),
      ],
      params: abilityKeys.map((key) => ({ label: abilityLabels[key], value: String(source.abilities[key]) })),
    },
  };
}
