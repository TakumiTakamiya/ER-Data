import { describe, expect, it } from 'vitest';
import { armorCreatePayload, emptyArmorCreateForm } from './armorForm';

describe('armor create payload', () => {
  it('keeps both armors and trims their names', () => {
    const form = emptyArmorCreateForm();
    form.armorSetId = 3;
    form.head.name = ' 騎士の兜 ';
    form.head.simpleSkill = ' 近接攻撃へのカット率+1 ';
    form.body.name = '騎士の胴鎧';

    expect(armorCreatePayload(form)).toMatchObject({
      armorSetId: 3,
      armors: {
        head: { name: '騎士の兜', simpleSkill: ' 近接攻撃へのカット率+1 ' },
        body: { name: '騎士の胴鎧' },
      },
    });
  });

  it('omits an armor whose name is blank after trimming', () => {
    const form = emptyArmorCreateForm();
    form.head.name = '   ';
    form.body.name = '旅人の服';

    expect(armorCreatePayload(form).armors).toEqual({
      head: null,
      body: { name: '旅人の服', weight: 0, physicalCut: 0, phenomenonCut: 0, poise: 0, simpleSkill: '' },
    });
  });

  it('rejects a form with no armor name', () => {
    expect(() => armorCreatePayload(emptyArmorCreateForm())).toThrow('頭または胴の防具名');
  });
});
