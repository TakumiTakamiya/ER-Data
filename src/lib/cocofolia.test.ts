import { describe, expect, it } from 'vitest';
import { buildCocofoliaCharacterData } from './cocofolia';

describe('buildCocofoliaCharacterData', () => {
  it('キャラクターのリソース、使用回数、現在能力値をココフォリア形式にする', () => {
    const result = buildCocofoliaCharacterData({
      name: '褪せ人',
      abilities: { vigor: 9, mind: 8, endurance: 7, strength: 6, dexterity: 5, intelligence: 4, faith: 3, arcane: 2 },
      resources: {
        maxHpModifier: 1,
        maxFpModifier: 2,
        maxBlessingModifier: 3,
        flaskTotalModifier: 0,
        crimsonFlaskHealModifier: 0,
        crimsonFlaskAllocation: 3,
        ceruleanFlaskHealModifier: 0,
        ceruleanFlaskAllocation: 2,
      },
      skills: [
        { name: '戦技', maxUses: 2 },
        { name: '常時効果', maxUses: null },
        { name: '一度きり', maxUses: 1 },
      ],
    });

    expect(result).toEqual({
      kind: 'character',
      data: {
        name: '褪せ人',
        status: [
          { label: 'HP', value: 8, max: 8 },
          { label: 'FP', value: 9, max: 9 },
          { label: '加護', value: 8, max: 8 },
          { label: '緋聖杯', value: 3, max: 3 },
          { label: '青聖杯', value: 2, max: 2 },
          { label: '戦技使用回数', value: 2, max: 2 },
          { label: '一度きり使用回数', value: 1, max: 1 },
        ],
        params: [
          { label: '生命力', value: '9' },
          { label: '精神力', value: '8' },
          { label: '持久力', value: '7' },
          { label: '筋力', value: '6' },
          { label: '技量', value: '5' },
          { label: '知力', value: '4' },
          { label: '信仰', value: '3' },
          { label: '神秘', value: '2' },
        ],
      },
    });
  });
});
