export const armorCsvHeaders = [
  'シリーズ名', 'シリーズ効果', '頭防具名', '胴防具名',
  '頭防具重量', '胴防具重量', '頭防具物理カット', '胴防具物理カット',
  '頭防具現象カット', '胴防具現象カット', '頭防具装備強靭値', '胴防具強靭値',
  '頭防具装備スキル', '胴防具装備スキル'
] as const;

export interface ArmorCsvItem {
  name: string;
  weight: number;
  physicalCut: number;
  phenomenonCut: number;
  poise: number;
  simpleSkill: string;
}

export interface ArmorCsvRow {
  seriesName: string;
  seriesEffect: string;
  head: ArmorCsvItem;
  body: ArmorCsvItem;
}

function csvRecords(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += character;
      continue;
    }
    if (character === '"') {
      if (field) throw new Error(`${rows.length + 1}行目: 引用符の位置が不正です。`);
      quoted = true;
    } else if (character === ',') {
      row.push(field); field = '';
    } else if (character === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (character !== '\r') field += character;
  }
  if (quoted) throw new Error(`${rows.length + 1}行目: 引用符が閉じられていません。`);
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function numberAt(row: string[], index: number, line: number, minimum?: number): number {
  const value = row[index].trim();
  if (!/^-?\d+$/.test(value)) throw new Error(`${line}行目「${armorCsvHeaders[index]}」: 整数を入力してください。`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (minimum !== undefined && parsed < minimum)) {
    throw new Error(`${line}行目「${armorCsvHeaders[index]}」: ${minimum ?? ''}以上の整数を入力してください。`);
  }
  return parsed;
}

function requiredAt(row: string[], index: number, line: number): string {
  const value = row[index].trim();
  if (!value) throw new Error(`${line}行目「${armorCsvHeaders[index]}」: 必須項目です。`);
  return value;
}

export function parseArmorCsv(source: string): ArmorCsvRow[] {
  const records = csvRecords(source.replace(/^\uFEFF/, '')).filter(row => row.some(value => value.trim()));
  if (!records.length) throw new Error('CSVが空です。');
  if (records[0].length !== armorCsvHeaders.length || armorCsvHeaders.some((header, index) => records[0][index]?.trim() !== header)) {
    throw new Error('CSVのヘッダーが指定の形式と一致しません。');
  }

  const rows = records.slice(1).map((row, index): ArmorCsvRow => {
    const line = index + 2;
    if (row.length > armorCsvHeaders.length) throw new Error(`${line}行目: 列数が${armorCsvHeaders.length}列を超えています。`);
    while (row.length < armorCsvHeaders.length) row.push('');
    return {
      seriesName: requiredAt(row, 0, line),
      seriesEffect: row[1].trim(),
      head: {
        name: requiredAt(row, 2, line),
        weight: numberAt(row, 4, line, 0),
        physicalCut: numberAt(row, 6, line),
        phenomenonCut: numberAt(row, 8, line),
        poise: numberAt(row, 10, line),
        simpleSkill: row[12].trim()
      },
      body: {
        name: requiredAt(row, 3, line),
        weight: numberAt(row, 5, line, 0),
        physicalCut: numberAt(row, 7, line),
        phenomenonCut: numberAt(row, 9, line),
        poise: numberAt(row, 11, line),
        simpleSkill: row[13].trim()
      }
    };
  });
  if (!rows.length) throw new Error('登録するデータ行がありません。');

  const seriesNames = new Set<string>();
  const armorNames = new Set<string>();
  rows.forEach((row, index) => {
    if (seriesNames.has(row.seriesName)) throw new Error(`${index + 2}行目: シリーズ名「${row.seriesName}」がCSV内で重複しています。`);
    seriesNames.add(row.seriesName);
    for (const armor of [row.head, row.body]) {
      if (armorNames.has(armor.name)) throw new Error(`${index + 2}行目: 防具名「${armor.name}」がCSV内で重複しています。`);
      armorNames.add(armor.name);
    }
  });
  return rows;
}
