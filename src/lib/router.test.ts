import { describe, expect, it } from 'vitest';
import { adminKindForPath } from './router';

describe('adminKindForPath', () => {
  it.each(['episodes', 'special-items', 'origins', 'armors', 'armor-sets', 'weapons', 'weapon-categories', 'shields', 'shield-categories', 'talismans', 'skills', 'skill-sets', 'spirit-ashes'])('recognizes the %s create route', (kind) => {
    expect(adminKindForPath(`/admin/${kind}/new`)).toBe(kind);
  });

  it('does not treat the admin menu as a create form', () => {
    expect(adminKindForPath('/admin/')).toBeNull();
  });
});
