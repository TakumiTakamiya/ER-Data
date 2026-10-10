export interface OcrWord {
  text: string; confidence: number; left: number; top: number; width: number; height: number;
}

export interface Range { start: number; end: number }

export interface ArmorLayout {
  anchorPattern: string;
  minimumAnchorCount: number;
  columns: {
    anchor: Range; name: Range; weight: Range; physical: Range; phenomenon: Range;
    poise: Range; skill: Range; seriesEffect: Range;
  };
  rows: { head: Range; body: Range; series: Range };
}

export interface ArmorRecord {
  name: string; weight: number | null; physical: number | null; phenomenon: number | null;
  poise: number | null; equipmentSkill: string;
}

export interface ArmorSeriesRecord {
  name: string; seriesEffect: string; head: ArmorRecord; body: ArmorRecord;
  confidence: number; warnings: string[];
}

export interface ArmorBand { top: number; bottom: number }

// 防具1.jpgを270度回転した画像に対する比率。別の撮影条件では --layout で上書きできます。
export const DEFAULT_ARMOR_LAYOUT: ArmorLayout = {
  anchorPattern: '防[具貝]',
  minimumAnchorCount: 2,
  columns: {
    anchor: { start: 0.29, end: 0.365 },
    name: { start: 0.285, end: 0.405 },
    weight: { start: 0.39, end: 0.435 },
    physical: { start: 0.425, end: 0.465 },
    phenomenon: { start: 0.455, end: 0.495 },
    poise: { start: 0.485, end: 0.535 },
    skill: { start: 0.525, end: 0.825 },
    seriesEffect: { start: 0.325, end: 0.825 },
  },
  rows: {
    head: { start: 0.27, end: 0.53 },
    body: { start: 0.45, end: 0.76 },
    series: { start: 0.72, end: 1.02 },
  },
};

export function parseTsvWords(tsv: string): OcrWord[] {
  return tsv.split(/\r?\n/).slice(1).flatMap((line) => {
    const cells = line.split('\t');
    if (cells.length < 12 || cells[0] !== '5') return [];
    const text = cells.slice(11).join('\t').trim();
    const confidence = Number(cells[10]);
    const [left, top, width, height] = cells.slice(6, 10).map(Number);
    if (!text || ![confidence, left, top, width, height].every(Number.isFinite)) return [];
    return [{ text, confidence, left, top, width, height }];
  });
}

function normalize(text: string): string {
  return text.normalize('NFKC').replace(/[\s|｜]/g, '').replace(/[‐‑‒–—―]/g, 'ー').trim();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function wordsInRegion(words: OcrWord[], width: number, top: number, bottom: number, range: Range): OcrWord[] {
  const left = width * range.start;
  const right = width * range.end;
  return words.filter((word) => {
    const x = word.left + word.width / 2;
    const y = word.top + word.height / 2;
    return x >= left && x <= right && y >= top && y <= bottom;
  });
}

function regionText(words: OcrWord[], width: number, top: number, bottom: number, range: Range): string {
  return normalize(wordsInRegion(words, width, top, bottom, range)
    .sort((a, b) => Math.abs(a.top - b.top) > Math.max(a.height, b.height) * 0.5 ? a.top - b.top : a.left - b.left)
    .map((word) => word.text).join(''));
}

function parseNumber(text: string, poise = false): number | null {
  const normalized = normalize(text);
  const stars = normalized.match(/[☆★*]/g);
  if (poise && stars) return stars.length;
  const cleaned = normalized.replace(/[〇○OＯ]/g, '0').replace(/[lI｜]/g, '1').replace(/[☆★×xX*]/g, '');
  if (poise && /[-ー―—]/.test(cleaned) && !/\d/.test(cleaned)) return 0;
  const match = cleaned.match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function cleanSkill(text: string): string {
  const cleaned = normalize(text).replace(/^装備スキル[（(]?参照[）)]?/, '');
  return /^[-ー―—]$/.test(cleaned) ? '' : cleaned;
}

function cleanName(text: string): string {
  return normalize(text).replace(/^(頭|胴)/, '').replace(/^[^一-龯々ぁ-んァ-ヶA-Za-z0-9]+/u, '');
}

function inferSeriesName(head: string, body: string, index: number): string {
  const headPrefix = head.match(/^(.+?)の/)?.[1];
  const bodyPrefix = body.match(/^(.+?)の/)?.[1];
  if (headPrefix && headPrefix === bodyPrefix) return headPrefix;
  let common = '';
  for (let i = 0; i < Math.min(head.length, body.length); i += 1) {
    if (head[i] !== body[i]) break;
    common += head[i];
  }
  common = common.replace(/[の・ー]+$/, '');
  return common.length >= 2 ? common : `シリーズ${index + 1}`;
}

function armorForRow(words: OcrWord[], width: number, top: number, bottom: number, layout: ArmorLayout): ArmorRecord {
  return {
    name: cleanName(regionText(words, width, top, bottom, layout.columns.name)),
    weight: parseNumber(regionText(words, width, top, bottom, layout.columns.weight)),
    physical: parseNumber(regionText(words, width, top, bottom, layout.columns.physical)),
    phenomenon: parseNumber(regionText(words, width, top, bottom, layout.columns.phenomenon)),
    poise: parseNumber(regionText(words, width, top, bottom, layout.columns.poise), true),
    equipmentSkill: cleanSkill(regionText(words, width, top, bottom, layout.columns.skill)),
  };
}

function rowBounds(bandTop: number, bandBottom: number, range: Range): [number, number] {
  const height = bandBottom - bandTop;
  return [bandTop + height * range.start, bandTop + height * range.end];
}

export function detectArmorBands(words: OcrWord[], width: number, height: number, layout: ArmorLayout = DEFAULT_ARMOR_LAYOUT): ArmorBand[] {
  const anchorExpression = new RegExp(layout.anchorPattern);
  let anchors = words.filter((word) => {
    const x = (word.left + word.width / 2) / width;
    return x >= layout.columns.anchor.start && x <= layout.columns.anchor.end && anchorExpression.test(normalize(word.text));
  }).sort((a, b) => a.top - b.top);
  anchors = anchors.filter((anchor, index) => index === 0 || anchor.top - anchors[index - 1].top > Math.max(anchor.height, anchors[index - 1].height));
  if (anchors.length < layout.minimumAnchorCount) return [];

  const periods = anchors.slice(1).map((anchor, index) => anchor.top - anchors[index].top).filter((period) => period > 0);
  const rawMedian = median(periods);
  const period = median(periods.filter((value) => value <= rawMedian * 1.25));
  const completedAnchors: OcrWord[] = [];
  for (const anchor of anchors) {
    const previous = completedAnchors.at(-1);
    if (previous) {
      for (let top = previous.top + period; anchor.top - top > period * 0.6; top += period) {
        completedAnchors.push({ ...previous, top, confidence: 0, text: '[推定ヘッダー]' });
      }
    }
    completedAnchors.push(anchor);
  }
  anchors = completedAnchors;
  const headerInset = Math.min(period * 0.08, median(anchors.map((anchor) => anchor.height)) * 0.3);
  const bandTops = anchors.map((anchor) => Math.max(0, anchor.top - headerInset));

  return anchors.map((anchor, index) => ({
    top: bandTops[index],
    bottom: index + 1 < bandTops.length ? bandTops[index + 1] : Math.min(height, bandTops[index] + period),
  }));
}

export function extractArmorSeries(words: OcrWord[], width: number, height: number, layout: ArmorLayout = DEFAULT_ARMOR_LAYOUT): ArmorSeriesRecord[] {
  const bands = detectArmorBands(words, width, height, layout);

  return bands.map(({ top: bandTop, bottom: bandBottom }, index) => {
    const [headTop, headBottom] = rowBounds(bandTop, bandBottom, layout.rows.head);
    const [bodyTop, bodyBottom] = rowBounds(bandTop, bandBottom, layout.rows.body);
    const [seriesTop, seriesBottom] = rowBounds(bandTop, bandBottom, layout.rows.series);
    const head = armorForRow(words, width, headTop, headBottom, layout);
    const body = armorForRow(words, width, bodyTop, bodyBottom, layout);
    const bandWords = words.filter((word) => word.top + word.height / 2 >= bandTop && word.top + word.height / 2 <= bandBottom);
    const confidence = Math.round((bandWords.reduce((sum, word) => sum + Math.max(0, word.confidence), 0) / Math.max(1, bandWords.length)) * 10) / 10;
    const warnings: string[] = [];
    for (const [slot, armor] of [['head', head], ['body', body]] as const) {
      if (!armor.name) warnings.push(`${slot}:name`);
      for (const field of ['weight', 'physical', 'phenomenon', 'poise'] as const) if (armor[field] === null) warnings.push(`${slot}:${field}`);
    }
    return {
      name: inferSeriesName(head.name, body.name, index),
      seriesEffect: regionText(words, width, seriesTop, seriesBottom, layout.columns.seriesEffect).replace(/^シリーズ効果/, '').replace(/^[-ー―—]$/, ''),
      head, body, confidence, warnings,
    };
  }).filter((series) => series.head.name || series.body.name);
}

export const CONTACT_SHEET = {
  rowHeight: 90,
  columns: { name: [0, 450], weight: [450, 560], physical: [560, 670], phenomenon: [670, 780], poise: [780, 890], skill: [890, 2090] },
  width: 2090,
} as const;

function contactText(words: OcrWord[], top: number, bottom: number, range: readonly [number, number]): string {
  return normalize(words.filter((word) => {
    const x = word.left + word.width / 2;
    const y = word.top + word.height / 2;
    return x >= range[0] && x <= range[1] && y >= top && y <= bottom;
  }).sort((a, b) => a.left - b.left).map((word) => word.text).join(''));
}

function contactArmor(words: OcrWord[], top: number): ArmorRecord {
  const bottom = top + CONTACT_SHEET.rowHeight;
  return {
    name: cleanName(contactText(words, top, bottom, CONTACT_SHEET.columns.name)),
    weight: parseNumber(contactText(words, top, bottom, CONTACT_SHEET.columns.weight)),
    physical: parseNumber(contactText(words, top, bottom, CONTACT_SHEET.columns.physical)),
    phenomenon: parseNumber(contactText(words, top, bottom, CONTACT_SHEET.columns.phenomenon)),
    poise: parseNumber(contactText(words, top, bottom, CONTACT_SHEET.columns.poise), true),
    equipmentSkill: cleanSkill(contactText(words, top, bottom, CONTACT_SHEET.columns.skill)),
  };
}

export function extractArmorSeriesFromContactSheet(words: OcrWord[], seriesCount: number): ArmorSeriesRecord[] {
  return Array.from({ length: seriesCount }, (_, index) => {
    const base = index * CONTACT_SHEET.rowHeight * 3;
    const head = contactArmor(words, base);
    const body = contactArmor(words, base + CONTACT_SHEET.rowHeight);
    const effectTop = base + CONTACT_SHEET.rowHeight * 2;
    const effectBottom = effectTop + CONTACT_SHEET.rowHeight;
    const relevant = words.filter((word) => word.top + word.height / 2 >= base && word.top + word.height / 2 <= effectBottom);
    const warnings: string[] = [];
    for (const [slot, armor] of [['head', head], ['body', body]] as const) {
      if (!armor.name) warnings.push(`${slot}:name`);
      for (const field of ['weight', 'physical', 'phenomenon', 'poise'] as const) if (armor[field] === null) warnings.push(`${slot}:${field}`);
    }
    return {
      name: inferSeriesName(head.name, body.name, index),
      seriesEffect: contactText(words, effectTop, effectBottom, [0, CONTACT_SHEET.width]).replace(/^シリーズ効果/, '').replace(/^[-ー―—]$/, ''),
      head,
      body,
      confidence: Math.round((relevant.reduce((sum, word) => sum + Math.max(0, word.confidence), 0) / Math.max(1, relevant.length)) * 10) / 10,
      warnings,
    };
  }).filter((series) => series.head.name || series.body.name);
}
