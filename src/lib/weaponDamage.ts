import type { AbilityKey } from './types';

const statKeys: Record<string, AbilityKey> = {
  筋: 'strength', 技: 'dexterity', 知: 'intelligence', 信: 'faith', 神: 'arcane'
};

function asciiDigits(value: string) {
  return value.replace(/[０-９]/g, digit => String('０１２３４５６７８９'.indexOf(digit)));
}

export function powerModifierValue(expression: string, modifiers: Partial<Record<AbilityKey, number>>) {
  const normalized = asciiDigits(expression).replace(/[＋+\s]/g, '');
  const numeric = [...normalized.matchAll(/\d+/g)].reduce((sum, match) => sum + Number(match[0]), 0);
  const stats = [...normalized].reduce((sum, token) => sum + (statKeys[token] ? (modifiers[statKeys[token]] ?? 0) : 0), 0);
  return numeric + stats;
}

export function weaponDamage(base: string, powerModifier: string, reinforcementLevel: number, modifiers: Partial<Record<AbilityKey, number>>) {
  const match = base.trim().match(/^(\d+)(★*)$/);
  if (!match) return base.trim() || '—';
  return `${Number(match[1]) + powerModifierValue(powerModifier, modifiers) + Math.max(0, Math.trunc(reinforcementLevel)) * 3}${match[2]}`;
}
