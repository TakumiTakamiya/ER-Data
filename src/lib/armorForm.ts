export interface ArmorDraft {
  name: string;
  weight: number;
  physicalCut: number;
  phenomenonCut: number;
  poise: number;
  simpleSkill: string;
}

export interface ArmorCreateForm {
  armorSetId: number | '';
  head: ArmorDraft;
  body: ArmorDraft;
  skillIds: number[];
}

export const emptyArmorDraft = (): ArmorDraft => ({
  name: '',
  weight: 0,
  physicalCut: 0,
  phenomenonCut: 0,
  poise: 0,
  simpleSkill: '',
});

export const emptyArmorCreateForm = (): ArmorCreateForm => ({
  armorSetId: '',
  head: emptyArmorDraft(),
  body: emptyArmorDraft(),
  skillIds: [],
});

export function armorCreatePayload(form: ArmorCreateForm) {
  const normalized = (armor: ArmorDraft) => {
    const name = armor.name.trim();
    return name ? { ...armor, name } : null;
  };

  const armors = { head: normalized(form.head), body: normalized(form.body) };
  if (!armors.head && !armors.body) throw new Error('頭または胴の防具名を入力してください。');

  return { armorSetId: form.armorSetId, skillIds: form.skillIds, armors };
}
