import { describe, expect, it, vi } from 'vitest';
import { ApiError, deleteJson, getJson, sendJson } from './api';

describe('D1 API client', () => {
  it('returns JSON data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 1 }]), { headers: { 'content-type': 'application/json' } })));
    await expect(getJson('/api/adventures')).resolves.toEqual([{ id: 1 }]);
  });
  it('surfaces structured errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'CONFLICT', message: '重複しています。' } }), { status: 409 })));
    await expect(sendJson('/api/adventures', 'POST', {})).rejects.toEqual(expect.objectContaining<ApiError>({ name: 'Error', status: 409, code: 'CONFLICT', message: '重複しています。' }));
  });
  it('sends DELETE requests without a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(deleteJson('/api/admin/armor-sets/7')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/armor-sets/7', expect.objectContaining({ method: 'DELETE' }));
  });
});
