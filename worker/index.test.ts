import { describe, expect, it } from 'vitest';
import worker from './index';

class Statement {
  values: unknown[] = [];
  constructor(public sql: string, private result: Record<string, unknown> | null = null) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first() { return this.result; }
  async all() { return { results: [], success: true }; }
  async run() { return { results: [], success: true }; }
}

class Database {
  batches: Statement[][] = [];
  prepare(sql: string) { return new Statement(sql); }
  async batch(statements: Statement[]) { this.batches.push(statements); return []; }
}

class ExistingArmorSetDatabase extends Database {
  prepare(sql: string) {
    const exists = sql.includes('SELECT id FROM armor_sets') || sql.includes('SELECT id FROM skills');
    return new Statement(sql, exists ? { id: 1 } : null);
  }
}

const row = (seriesName: string) => ({
  seriesName,
  seriesEffect: 'シリーズ効果',
  head: { name: `${seriesName}の兜`, weight: 1, physicalCut: 2, phenomenonCut: 3, poise: 4, simpleSkill: '頭の簡易スキル' },
  body: { name: `${seriesName}の鎧`, weight: 5, physicalCut: 6, phenomenonCut: 7, poise: 8, simpleSkill: '胴の簡易スキル' }
});

describe('armor CSV import API', () => {
  it('inserts armor skills only as simple_skill strings', async () => {
    const db = new Database();
    const response = await worker.fetch(new Request('https://example.test/api/admin/armors/import', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: [row('騎士')] })
    }), { DB: db, ASSETS: { fetch: async () => new Response() } } as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ armorSets: 1, armors: 2 });
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0].some(statement => statement.sql.includes('armor_skills'))).toBe(false);
    const armorInsert = db.batches[0].find(statement => statement.sql.includes('INSERT INTO armors'));
    expect(armorInsert?.sql).toContain('simple_skill');
    expect(armorInsert?.values).toContain('頭の簡易スキル');
    expect(armorInsert?.values).toContain('胴の簡易スキル');
  });

  it('rejects duplicate series before creating a batch', async () => {
    const db = new Database();
    const response = await worker.fetch(new Request('https://example.test/api/admin/armors/import', {
      method: 'POST', body: JSON.stringify({ rows: [row('騎士'), row('騎士')] })
    }), { DB: db, ASSETS: { fetch: async () => new Response() } } as never);

    expect(response.status).toBe(400);
    expect(db.batches).toHaveLength(0);
  });
});

describe('armor set API', () => {
  it('updates its name, effect, and linked skills together', async () => {
    const db = new ExistingArmorSetDatabase();
    const response = await worker.fetch(new Request('https://example.test/api/admin/armor-sets/7', {
      method: 'PUT', body: JSON.stringify({ name: '騎士', seriesEffect: '強靭＋☆', skillIds: [3, 5] })
    }), { DB: db, ASSETS: { fetch: async () => new Response() } } as never);

    expect(response.status).toBe(200);
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0].map(statement => statement.sql)).toEqual([
      expect.stringContaining('UPDATE armor_sets'),
      expect.stringContaining('DELETE FROM armor_set_skills'),
      expect.stringContaining('INSERT INTO armor_set_skills'),
      expect.stringContaining('INSERT INTO armor_set_skills')
    ]);
    expect(db.batches[0][0].values).toEqual(['騎士', '強靭＋☆', 7]);
  });
});
