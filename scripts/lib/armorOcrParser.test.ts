import { describe, expect, it } from 'vitest';
import { CONTACT_SHEET, DEFAULT_ARMOR_LAYOUT, extractArmorSeries, extractArmorSeriesFromContactSheet, parseTsvWords, type OcrWord } from './armorOcrParser';

const word = (text: string, x: number, y: number, confidence = 92): OcrWord => ({ text, confidence, left: x, top: y, width: 20, height: 20 });

describe('armor OCR parser', () => {
  it('parses word rows from Tesseract TSV', () => {
    const tsv = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t10\t20\t30\t40\t88.5\t市民の頭冠';
    expect(parseTsvWords(tsv)).toEqual([{ text: '市民の頭冠', confidence: 88.5, left: 10, top: 20, width: 30, height: 40 }]);
  });

  it('extracts two armor rows and the series effect by coordinates', () => {
    const words: OcrWord[] = [
      word('防具名', 300, 100), word('市民の頭冠', 320, 120), word('3', 400, 120), word('4', 435, 120), word('2', 470, 120), word('-', 505, 120),
      word('市民の上服', 320, 145), word('3', 400, 145), word('2', 435, 145), word('4', 470, 145), word('☆', 505, 145), word('属性蓄積耐性', 390, 165),
      word('防具名', 300, 200), word('旅人の帽子', 320, 220), word('1', 400, 220), word('0', 435, 220), word('2', 470, 220), word('-', 505, 220),
      word('旅人の服', 320, 245), word('4', 400, 245), word('4', 435, 245), word('4', 470, 245), word('☆', 505, 245),
    ];
    const result = extractArmorSeries(words, 1000, 400, DEFAULT_ARMOR_LAYOUT);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: '市民', seriesEffect: '属性蓄積耐性',
      head: { name: '市民の頭冠', weight: 3, physical: 4, phenomenon: 2, poise: 0 },
      body: { name: '市民の上服', weight: 3, physical: 2, phenomenon: 4, poise: 1 },
    });
  });

  it('parses isolated contact-sheet cells including stars and skills', () => {
    const at = (text: string, x: number, row: number): OcrWord => word(text, x, row * CONTACT_SHEET.rowHeight + 30);
    const result = extractArmorSeriesFromContactSheet([
      at('市民の頭冠', 100, 0), at('3', 500, 0), at('4', 600, 0), at('2', 700, 0), at('-', 800, 0), at('', 1000, 0),
      at('市民の上服', 100, 1), at('3', 500, 1), at('2', 600, 1), at('4', 700, 1), at('*', 800, 1),
      at('属性損害耐性「聖」', 100, 2),
    ], 1);
    expect(result[0]).toMatchObject({
      name: '市民', seriesEffect: '属性損害耐性「聖」',
      head: { weight: 3, physical: 4, phenomenon: 2, poise: 0 },
      body: { weight: 3, physical: 2, phenomenon: 4, poise: 1 },
    });
  });
});
