import { describe, expect, it, vi } from 'vitest';
import { SheetApiError, SheetsRepository } from './sheetsRepository';

const batchBody = {
  valueRanges: [
    { values: [
      ['id', 'name', 'level', 'classId', 'vigor', 'mind', 'endurance', 'notes', 'updatedAt'],
      ['char-1', '褪せ人', '12', 'hero', '14', '10', '16', '', '2026-01-01T00:00:00.000Z'],
    ] },
    { values: [
      ['id', 'name', 'guardBonus', 'description'],
      ['hero', '勇者', '2', '蛮地の勇者'],
    ] },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('SheetsRepository', () => {
  it('calls the native fetch with the browser global as its receiver', async () => {
    const originalFetch = globalThis.fetch;
    const receiverAwareFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(jsonResponse(batchBody));
    }) as unknown as typeof fetch;
    globalThis.fetch = receiverAwareFetch;

    try {
      const repository = new SheetsRepository('sheet-id', () => 'token');
      await expect(repository.listCharacters()).resolves.toMatchObject({
        characters: [{ name: '褪せ人' }],
      });
      expect(receiverAwareFetch).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('batch loads and joins characters and classes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(batchBody));
    const repository = new SheetsRepository('sheet-id', () => 'token', fetcher);
    const result = await repository.listCharacters();
    expect(result.characters[0]).toMatchObject({ name: '褪せ人', guard: 6 });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('values:batchGet'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    }));
  });

  it('appends a new character', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ updates: {} }));
    const repository = new SheetsRepository('sheet-id', () => 'token', fetcher);
    await repository.createCharacter({
      id: 'new-id', name: '預言者', level: 7, classId: 'prophet', vigor: 10, mind: 14, endurance: 8, notes: '',
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain(':append');
    expect(init?.method).toBe('POST');
    expect(String(init?.body)).toContain('new-id');
  });

  it('finds the sheet row before updating', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(batchBody))
      .mockResolvedValueOnce(jsonResponse({ updatedRows: 1 }));
    const repository = new SheetsRepository('sheet-id', () => 'token', fetcher);
    await repository.updateCharacter({
      id: 'char-1', name: '褪せ人 改', level: 13, classId: 'hero', vigor: 15, mind: 10, endurance: 16, notes: '',
    });
    expect(String(fetcher.mock.calls[1][0])).toContain('Characters!A2%3AI2');
    expect(fetcher.mock.calls[1][1]?.method).toBe('PUT');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [500, 'api'],
  ] as const)('maps HTTP %s to %s', async (status, kind) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, status));
    const repository = new SheetsRepository('sheet-id', () => 'token', fetcher);
    const promise = repository.listCharacters();
    await expect(promise).rejects.toBeInstanceOf(SheetApiError);
    await expect(promise).rejects.toMatchObject({ kind, status });
  });
});
