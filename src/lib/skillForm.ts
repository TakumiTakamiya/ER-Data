const fullWidthDigits = ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'];

function toFullWidth(value: number): string {
  return String(value).replace(/\d/g, (digit) => fullWidthDigits[Number(digit)]);
}

function fromFullWidth(value: string): number {
  return Number(value.replace(/[０-９]/g, (digit) => String(fullWidthDigits.indexOf(digit))));
}

function appendCost(current: string, token: string): string {
  const trimmed = current.trim();
  return trimmed ? `${trimmed}＋${token}` : token;
}

export type CostShortcut = 'dice' | 'sequence' | 'pair' | 'fp';

export function applyCostShortcut(current: string, shortcut: CostShortcut): string {
  if (shortcut === 'fp') {
    const pattern = /FP(■+)/i;
    return pattern.test(current)
      ? current.replace(pattern, (_match, boxes: string) => `FP${boxes}■`)
      : appendCost(current, 'FP■');
  }

  const settings: Record<Exclude<CostShortcut, 'fp'>, { label: string; initial: number }> = {
    dice: { label: 'ダイス', initial: 1 },
    sequence: { label: '連番', initial: 2 },
    pair: { label: 'ゾロ', initial: 2 },
  };
  const { label, initial } = settings[shortcut];
  const pattern = new RegExp(`${label}([0-9０-９]+)個`);
  return pattern.test(current)
    ? current.replace(pattern, (_match, count: string) => `${label}${toFullWidth(fromFullWidth(count) + 1)}個`)
    : appendCost(current, `${label}${toFullWidth(initial)}個`);
}
