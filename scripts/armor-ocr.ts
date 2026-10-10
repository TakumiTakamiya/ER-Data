#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';
import {
  CONTACT_SHEET, DEFAULT_ARMOR_LAYOUT, detectArmorBands, extractArmorSeriesFromContactSheet,
  parseTsvWords, type ArmorBand, type ArmorLayout, type Range,
  type OcrWord,
} from './lib/armorOcrParser.js';

interface CliOptions {
  input: string; output: string; csv?: string; debugDir?: string; layout?: string;
  rotation: number; scale: number; language: string;
}

function usage(): never {
  console.error(`使い方:
  npm run armor:ocr -- --input <画像> [--output armor.json]

オプション:
  --csv <path>         CSVも出力
  --debug-dir <dir>    補正済み画像とOCR TSVを保存
  --layout <json>      列位置などを上書きするレイアウトJSON
  --rotation <degree>  時計回りの回転角（既定: 270）
  --scale <number>     OCR前の拡大率（既定: 2）
  --language <langs>   Tesseract言語（既定: jpn、複数は jpn+eng）`);
  process.exit(2);
}

function takeValue(args: string[], index: number): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) usage();
  return value;
}

function parseArgs(args: string[]): CliOptions {
  const values: Partial<CliOptions> = { rotation: 270, scale: 2, language: 'jpn' };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--help' || flag === '-h') usage();
    if (flag === '--input' || flag === '-i') values.input = takeValue(args, index++);
    else if (flag === '--output' || flag === '-o') values.output = takeValue(args, index++);
    else if (flag === '--csv') values.csv = takeValue(args, index++);
    else if (flag === '--debug-dir') values.debugDir = takeValue(args, index++);
    else if (flag === '--layout') values.layout = takeValue(args, index++);
    else if (flag === '--rotation') values.rotation = Number(takeValue(args, index++));
    else if (flag === '--scale') values.scale = Number(takeValue(args, index++));
    else if (flag === '--language') values.language = takeValue(args, index++);
    else usage();
  }
  if (!values.input) usage();
  if (!Number.isFinite(values.rotation) || ![0, 90, 180, 270].includes(values.rotation!)) usage();
  if (!Number.isFinite(values.scale) || values.scale! < 1 || values.scale! > 4) usage();
  const input = resolve(values.input);
  return {
    input,
    output: resolve(values.output ?? join(process.cwd(), `${basename(input, extname(input))}.armor.json`)),
    csv: values.csv ? resolve(values.csv) : undefined,
    debugDir: values.debugDir ? resolve(values.debugDir) : undefined,
    layout: values.layout ? resolve(values.layout) : undefined,
    rotation: values.rotation!, scale: values.scale!, language: values.language!,
  };
}

async function loadLayout(path?: string): Promise<ArmorLayout> {
  if (!path) return DEFAULT_ARMOR_LAYOUT;
  const custom = JSON.parse(await readFile(path, 'utf8')) as Partial<ArmorLayout>;
  return { ...DEFAULT_ARMOR_LAYOUT, ...custom, columns: { ...DEFAULT_ARMOR_LAYOUT.columns, ...custom.columns }, rows: { ...DEFAULT_ARMOR_LAYOUT.rows, ...custom.rows } };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function asCsv(series: ReturnType<typeof extractArmorSeries>): string {
  const header = ['シリーズ', 'シリーズ効果', '部位', '防具名', '重量', '物理値', '現象値', '強靭値', '装備スキル', 'OCR信頼度'];
  const rows = series.flatMap((set) => [
    [set.name, set.seriesEffect, 'HEAD', set.head.name, set.head.weight, set.head.physical, set.head.phenomenon, set.head.poise, set.head.equipmentSkill, set.confidence],
    [set.name, set.seriesEffect, 'BODY', set.body.name, set.body.weight, set.body.physical, set.body.phenomenon, set.body.poise, set.body.equipmentSkill, set.confidence],
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function rowRange(band: ArmorBand, range: Range): [number, number] {
  const height = band.bottom - band.top;
  return [band.top + height * range.start, band.top + height * range.end];
}

async function contactCell(image: Buffer, imageWidth: number, imageHeight: number, xRange: Range, yRange: [number, number], width: number, height: number): Promise<Buffer> {
  const insetX = 4;
  const insetY = 8;
  const left = Math.max(0, Math.round(imageWidth * xRange.start) + insetX);
  const top = Math.max(0, Math.round(yRange[0]) + insetY);
  const right = Math.min(imageWidth, Math.round(imageWidth * xRange.end) - insetX);
  const bottom = Math.min(imageHeight, Math.round(yRange[1]) - insetY);
  return sharp(image).extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
    .resize({ width: width - 12, height: height - 12, fit: 'contain', background: '#ffffff' }).png().toBuffer();
}

async function createContactSheet(image: Buffer, imageWidth: number, imageHeight: number, bands: ArmorBand[], layout: ArmorLayout): Promise<Buffer> {
  const fields = ['name', 'weight', 'physical', 'phenomenon', 'poise', 'skill'] as const;
  const composites: sharp.OverlayOptions[] = [];
  for (const [index, band] of bands.entries()) {
    for (const [rowIndex, sourceRow] of [layout.rows.head, layout.rows.body].entries()) {
      const y = (index * 3 + rowIndex) * CONTACT_SHEET.rowHeight;
      for (const field of fields) {
        const [left, right] = CONTACT_SHEET.columns[field];
        composites.push({
          input: await contactCell(image, imageWidth, imageHeight, layout.columns[field], rowRange(band, sourceRow), right - left, CONTACT_SHEET.rowHeight),
          left: left + 6, top: y + 6,
        });
      }
    }
    const effectY = (index * 3 + 2) * CONTACT_SHEET.rowHeight;
    composites.push({
      input: await contactCell(image, imageWidth, imageHeight, layout.columns.seriesEffect, rowRange(band, layout.rows.series), CONTACT_SHEET.width, CONTACT_SHEET.rowHeight),
      left: 6, top: effectY + 6,
    });
  }
  return sharp({ create: { width: CONTACT_SHEET.width, height: bands.length * CONTACT_SHEET.rowHeight * 3, channels: 3, background: '#ffffff' } })
    .composite(composites).png().toBuffer();
}

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

async function recognizeContactCells(worker: TesseractWorker, sheet: Buffer, seriesCount: number): Promise<{ words: OcrWord[]; cells: object[] }> {
  const words: OcrWord[] = [];
  const cells: object[] = [];
  const textFields = ['name', 'skill'] as const;
  let completed = 0;
  const total = seriesCount * 13;

  const recognize = async (index: number, row: number, field: keyof typeof CONTACT_SHEET.columns | 'effect', numeric: boolean) => {
    const [left, right] = field === 'effect' ? [0, CONTACT_SHEET.width] : CONTACT_SHEET.columns[field];
    const top = (index * 3 + row) * CONTACT_SHEET.rowHeight;
    const padding = numeric ? 18 : 5;
    let cellPipeline = sharp(sheet).extract({ left: left + padding, top: top + padding, width: right - left - padding * 2, height: CONTACT_SHEET.rowHeight - padding * 2 });
    if (numeric) cellPipeline = cellPipeline.grayscale().normalize().threshold(175).resize({ width: 400, height: 240, fit: 'contain', background: '#ffffff' });
    const cell = await cellPipeline.png().toBuffer();
    const result = await worker.recognize(cell, {}, { text: true, blocks: true });
    let text = result.data.text.replace(/\r?\n/g, '').trim();
    const confidence = Number(result.data.confidence ?? 0);
    const minimumConfidence = numeric ? 15 : field === 'name' ? 25 : 40;
    if (confidence < minimumConfidence) text = '';
    if (text) words.push({ text, confidence, left: (left + right) / 2, top: top + CONTACT_SHEET.rowHeight / 2, width: 1, height: 1 });
    cells.push({ series: index + 1, row: row === 0 ? 'head' : row === 1 ? 'body' : 'series', field, text, confidence });
    completed += 1;
    if (completed % 10 === 0 || completed === total) process.stderr.write(`\rセルOCR ${completed}/${total}`);
  };

  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '', preserve_interword_spaces: '1' });
  for (let index = 0; index < seriesCount; index += 1) {
    for (const row of [0, 1]) for (const field of textFields) await recognize(index, row, field, false);
    await recognize(index, 2, 'effect', false);
  }
  await worker.reinitialize('eng');
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, tessedit_char_whitelist: '0123456789-*', preserve_interword_spaces: '0', user_defined_dpi: '300' });
  for (let index = 0; index < seriesCount; index += 1) {
    for (const row of [0, 1]) for (const field of ['weight', 'physical', 'phenomenon', 'poise'] as const) await recognize(index, row, field, true);
  }
  process.stderr.write('\n');
  return { words, cells };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const layout = await loadLayout(options.layout);
  const source = sharp(options.input, { failOn: 'error' }).rotate(options.rotation);
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) throw new Error('画像サイズを取得できませんでした。');
  const image = await source.resize({ width: Math.round(metadata.width * options.scale) }).grayscale().normalize().sharpen({ sigma: 0.8 }).png().toBuffer();
  const imageMetadata = await sharp(image).metadata();
  if (!imageMetadata.width || !imageMetadata.height) throw new Error('補正後の画像サイズを取得できませんでした。');
  if (options.debugDir) {
    await mkdir(options.debugDir, { recursive: true });
    await writeFile(join(options.debugDir, 'preprocessed.png'), image);
  }

  const cachePath = join(process.cwd(), 'node_modules', '.cache', 'tesseract');
  await mkdir(cachePath, { recursive: true });
  let reportPageProgress = true;
  const worker = await createWorker(options.language.split('+'), undefined, { cachePath, logger(message) {
    if (reportPageProgress && message.status === 'recognizing text') process.stderr.write(`\rページOCR ${Math.round(message.progress * 100).toString().padStart(3)}%`);
  } });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    const result = await worker.recognize(image, {}, { text: true, tsv: true, blocks: true });
    process.stderr.write('\n');
    const pageTsv = result.data.tsv ?? '';
    const bands = detectArmorBands(parseTsvWords(pageTsv), imageMetadata.width, imageMetadata.height, layout);
    if (!bands.length) throw new Error('シリーズ行を検出できませんでした。--debug-dir のOCR結果を確認し、必要なら --layout で位置を調整してください。');
    const contactSheet = await createContactSheet(image, imageMetadata.width, imageMetadata.height, bands, layout);
    reportPageProgress = false;
    const cellResult = await recognizeContactCells(worker, contactSheet, bands.length);
    if (options.debugDir) {
      await writeFile(join(options.debugDir, 'ocr.txt'), result.data.text, 'utf8');
      await writeFile(join(options.debugDir, 'ocr.tsv'), pageTsv, 'utf8');
      await writeFile(join(options.debugDir, 'contact-sheet.png'), contactSheet);
      await writeFile(join(options.debugDir, 'cells.json'), `${JSON.stringify(cellResult.cells, null, 2)}\n`, 'utf8');
    }
    const series = extractArmorSeriesFromContactSheet(cellResult.words, bands.length);
    if (!series.length) throw new Error('セルをOCRできませんでした。--debug-dir のコンタクトシートを確認してください。');
    const document = { source: options.input, generatedAt: new Date().toISOString(), ocr: { engine: 'tesseract.js', language: options.language, rotation: options.rotation, scale: options.scale }, series };
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    if (options.csv) {
      await mkdir(dirname(options.csv), { recursive: true });
      await writeFile(options.csv, asCsv(series), 'utf8');
    }
    console.log(`${series.length}シリーズを ${options.output} に出力しました。`);
  } finally {
    await worker.terminate();
  }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
