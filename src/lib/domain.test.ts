import { describe, expect, it } from 'vitest';
import {
  DataValidationError,
  parseCharacters,
  parseClasses,
  toViewModels,
  validateCharacterInput,
} from './domain';

const characterValues = [
  ['id', 'name', 'level', 'classId', 'vigor', 'mind', 'endurance', 'notes', 'updatedAt'],
  ['char-1', 'メリナ', '20', 'vagabond', '18', '12', '17', 'テスト', '2026-01-01T00:00:00.000Z'],
];
const classValues = [
  ['id', 'name', 'guardBonus', 'description'],
  ['vagabond', '放浪騎士', '3', '頑健な素性'],
];

describe('sheet domain', () => {
  it('parses rows, resolves the foreign key, and calculates guard', () => {
    const characters = parseCharacters(characterValues);
    const classes = parseClasses(classValues);
    const [view] = toViewModels(characters, classes);
    expect(view.classInfo?.name).toBe('放浪騎士');
    expect(view.guard).toBe(7); // floor(17 / 4) + 3
    expect(view.sheetRow).toBe(2);
  });

  it('keeps a character visible when its foreign key is missing', () => {
    const [view] = toViewModels(parseCharacters(characterValues), []);
    expect(view.classInfo).toBeNull();
    expect(view.guard).toBeNull();
  });

  it('rejects missing headers', () => {
    expect(() => parseCharacters([['id', 'name']])).toThrow(DataValidationError);
  });

  it('rejects duplicate ids', () => {
    expect(() => parseCharacters([...characterValues, characterValues[1]])).toThrow(/重複/);
  });

  it('normalizes and validates form input', () => {
    expect(validateCharacterInput({
      name: '  褪せ人  ', level: 1, classId: ' vagabond ', vigor: 10, mind: 10, endurance: 10, notes: ' memo ',
    })).toMatchObject({ name: '褪せ人', classId: 'vagabond', notes: 'memo' });
    expect(() => validateCharacterInput({
      name: '', level: 0, classId: '', vigor: 0, mind: 0, endurance: 0, notes: '',
    })).toThrow(DataValidationError);
  });
});
