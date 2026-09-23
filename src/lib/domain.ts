import type { CharacterInput, CharacterRow, CharacterViewModel, ClassRow } from './types';

export const CHARACTER_HEADERS = [
  'id', 'name', 'level', 'classId', 'vigor', 'mind', 'endurance', 'notes', 'updatedAt',
] as const;
export const CLASS_HEADERS = ['id', 'name', 'guardBonus', 'description'] as const;

export class DataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataValidationError';
  }
}

function assertHeaders(actual: unknown[], expected: readonly string[], sheetName: string): void {
  const headers = actual.map(String);
  const missing = expected.filter((header) => !headers.includes(header));
  if (missing.length) {
    throw new DataValidationError(`${sheetName} シートに必要な列がありません: ${missing.join(', ')}`);
  }
}

function rowObject(headers: unknown[], row: unknown[]): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [String(header), String(row[index] ?? '').trim()]));
}

function integer(value: string, label: string, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new DataValidationError(`${label} は ${minimum} 以上の整数で入力してください。`);
  }
  return parsed;
}

function ensureUniqueIds<T extends { id: string }>(rows: T[], sheetName: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new DataValidationError(`${sheetName} シートでID「${row.id}」が重複しています。`);
    seen.add(row.id);
  }
}

export function parseCharacters(values: unknown[][]): CharacterRow[] {
  if (!values.length) throw new DataValidationError('Characters シートが空です。');
  assertHeaders(values[0], CHARACTER_HEADERS, 'Characters');
  const headers = values[0];
  const rows = values.slice(1).flatMap((row, index) => {
    const value = rowObject(headers, row);
    if (!value.id && !value.name) return [];
    if (!value.id || !value.name || !value.classId) {
      throw new DataValidationError(`Characters シートの ${index + 2} 行目に必須値がありません。`);
    }
    return [{
      id: value.id,
      name: value.name,
      level: integer(value.level, `${index + 2} 行目のlevel`, 1),
      classId: value.classId,
      vigor: integer(value.vigor, `${index + 2} 行目のvigor`, 1),
      mind: integer(value.mind, `${index + 2} 行目のmind`, 1),
      endurance: integer(value.endurance, `${index + 2} 行目のendurance`, 1),
      notes: value.notes,
      updatedAt: value.updatedAt,
      sheetRow: index + 2,
    }];
  });
  ensureUniqueIds(rows, 'Characters');
  return rows;
}

export function parseClasses(values: unknown[][]): ClassRow[] {
  if (!values.length) throw new DataValidationError('Classes シートが空です。');
  assertHeaders(values[0], CLASS_HEADERS, 'Classes');
  const headers = values[0];
  const rows = values.slice(1).flatMap((row, index) => {
    const value = rowObject(headers, row);
    if (!value.id && !value.name) return [];
    if (!value.id || !value.name) {
      throw new DataValidationError(`Classes シートの ${index + 2} 行目に必須値がありません。`);
    }
    return [{
      id: value.id,
      name: value.name,
      guardBonus: integer(value.guardBonus, `${index + 2} 行目のguardBonus`, 0),
      description: value.description,
    }];
  });
  ensureUniqueIds(rows, 'Classes');
  return rows;
}

export function toViewModels(characters: CharacterRow[], classes: ClassRow[]): CharacterViewModel[] {
  const classById = new Map(classes.map((classRow) => [classRow.id, classRow]));
  return characters.map((character) => {
    const classInfo = classById.get(character.classId) ?? null;
    return {
      ...character,
      classInfo,
      guard: classInfo ? Math.floor(character.endurance / 4) + classInfo.guardBonus : null,
    };
  });
}

export function validateCharacterInput(input: CharacterInput): CharacterInput {
  const name = input.name.trim();
  const classId = input.classId.trim();
  if (!name) throw new DataValidationError('名前を入力してください。');
  if (!classId) throw new DataValidationError('素性を選択してください。');
  return {
    ...input,
    name,
    classId,
    notes: input.notes.trim(),
    level: integer(String(input.level), 'レベル', 1),
    vigor: integer(String(input.vigor), '生命力', 1),
    mind: integer(String(input.mind), '精神力', 1),
    endurance: integer(String(input.endurance), '持久力', 1),
  };
}
