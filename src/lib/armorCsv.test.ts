import { describe, expect, it } from 'vitest';
import { parseArmorCsv } from './armorCsv';

const header = 'シリーズ名,シリーズ効果,頭防具名,胴防具名,頭防具重量,胴防具重量,頭防具物理カット,胴防具物理カット,頭防具現象カット,胴防具現象カット,頭防具装備強靭値,胴防具強靭値,頭防具装備スキル,胴防具装備スキル';

describe('armor CSV parser', () => {
  it('maps equipment skills to freeform simple skill fields', () => {
    const [row] = parseArmorCsv(`\uFEFF${header}\r\n市民,,市民の頭冠,市民の上服,3,3,4,2,2,4,0,1,毒耐性＋１,`);
    expect(row).toEqual({
      seriesName: '市民', seriesEffect: '',
      head: { name: '市民の頭冠', weight: 3, physicalCut: 4, phenomenonCut: 2, poise: 0, simpleSkill: '毒耐性＋１' },
      body: { name: '市民の上服', weight: 3, physicalCut: 2, phenomenonCut: 4, poise: 1, simpleSkill: '' }
    });
  });

  it('treats omitted trailing skill columns as empty', () => {
    const [row] = parseArmorCsv(`${header}\n市民,,市民の頭冠,市民の上服,3,3,4,2,2,4,0,1,`);
    expect(row.head.simpleSkill).toBe('');
    expect(row.body.simpleSkill).toBe('');
  });

  it('supports quoted commas, newlines, and escaped quotes', () => {
    const [row] = parseArmorCsv(`${header}\n貴人,"効果,追加",貴人の頭環,貴人の服,3,3,3,2,3,4,0,1,"知力＋１\n属性耐性「""魔""」",`);
    expect(row.seriesEffect).toBe('効果,追加');
    expect(row.head.simpleSkill).toBe('知力＋１\n属性耐性「"魔"」');
  });

  it('reports invalid row values with the CSV line', () => {
    expect(() => parseArmorCsv(`${header}\n市民,,頭,胴,重い,3,4,2,2,4,0,1,,`)).toThrow('2行目「頭防具重量」');
  });

  it('rejects duplicate names before upload', () => {
    expect(() => parseArmorCsv(`${header}\n市民,,頭,胴,1,1,1,1,1,1,1,1,,\n市民,,頭2,胴2,1,1,1,1,1,1,1,1,,`)).toThrow('シリーズ名「市民」');
  });
});
