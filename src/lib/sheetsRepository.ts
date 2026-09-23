import {
  CHARACTER_HEADERS,
  parseCharacters,
  parseClasses,
  toViewModels,
  validateCharacterInput,
} from './domain';
import type { CharacterInput, CharacterRow, SheetData } from './types';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export type SheetErrorKind = 'unauthorized' | 'forbidden' | 'not-found' | 'api';

export class SheetApiError extends Error {
  constructor(message: string, public readonly kind: SheetErrorKind, public readonly status: number) {
    super(message);
    this.name = 'SheetApiError';
  }
}

interface ValueRange { values?: unknown[][] }
interface BatchGetResponse { valueRanges?: ValueRange[] }

function messageForStatus(status: number): { kind: SheetErrorKind; message: string } {
  if (status === 401) return { kind: 'unauthorized', message: '認証の有効期限が切れました。Googleに再接続してください。' };
  if (status === 403) return { kind: 'forbidden', message: 'このスプレッドシートの編集権限がありません。共有設定を確認してください。' };
  if (status === 404) return { kind: 'not-found', message: 'スプレッドシートまたはシートが見つかりません。設定を確認してください。' };
  return { kind: 'api', message: 'Google Sheets APIとの通信に失敗しました。' };
}

export class SheetsRepository {
  constructor(
    private readonly spreadsheetId: string,
    private readonly getAccessToken: () => string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(`${SHEETS_API}/${encodeURIComponent(this.spreadsheetId)}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const mapped = messageForStatus(response.status);
      throw new SheetApiError(mapped.message, mapped.kind, response.status);
    }
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  }

  async listCharacters(): Promise<SheetData> {
    const params = new URLSearchParams();
    params.append('ranges', 'Characters!A:I');
    params.append('ranges', 'Classes!A:D');
    params.set('majorDimension', 'ROWS');
    const result = await this.request<BatchGetResponse>(`values:batchGet?${params}`);
    const characters = parseCharacters(result.valueRanges?.[0]?.values ?? []);
    const classes = parseClasses(result.valueRanges?.[1]?.values ?? []);
    return { characters: toViewModels(characters, classes), classes };
  }

  async createCharacter(rawInput: CharacterInput): Promise<void> {
    const input = validateCharacterInput(rawInput);
    const id = input.id || crypto.randomUUID();
    const values = this.toSheetRow({ ...input, id });
    await this.request(`values/${encodeURIComponent('Characters!A:I')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ majorDimension: 'ROWS', values: [values] }),
    });
  }

  async updateCharacter(rawInput: CharacterInput): Promise<void> {
    const id = rawInput.id;
    if (!id) throw new Error('更新対象のIDがありません。');
    const input = validateCharacterInput(rawInput);
    const data = await this.listCharacters();
    const current = data.characters.find((character) => character.id === id);
    if (!current) throw new SheetApiError('更新対象のキャラクターが見つかりません。再読み込みしてください。', 'not-found', 404);
    const range = `Characters!A${current.sheetRow}:I${current.sheetRow}`;
    await this.request(`values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ majorDimension: 'ROWS', values: [this.toSheetRow({ ...input, id })] }),
    });
  }

  private toSheetRow(input: CharacterInput & { id: string }): (string | number)[] {
    const row: Record<(typeof CHARACTER_HEADERS)[number], string | number> = {
      id: input.id,
      name: input.name,
      level: input.level,
      classId: input.classId,
      vigor: input.vigor,
      mind: input.mind,
      endurance: input.endurance,
      notes: input.notes,
      updatedAt: new Date().toISOString(),
    };
    return CHARACTER_HEADERS.map((header) => row[header]);
  }
}
