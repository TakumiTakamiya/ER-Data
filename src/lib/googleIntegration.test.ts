import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorize } from './googleAuth';
import { pickSpreadsheet } from './googlePicker';

describe('Google integration', () => {
  beforeEach(() => {
    window.google = undefined;
    window.gapi = undefined;
  });

  it('requests only drive.file without folding in prior broad grants', async () => {
    let tokenConfig: Parameters<NonNullable<Window['google']>['accounts']['oauth2']['initTokenClient']>[0] | undefined;
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => {
            tokenConfig = config;
            return {
              requestAccessToken: () => config.callback({ access_token: 'per-file-token' }),
            };
          },
          revoke: vi.fn(),
        },
      },
    };

    await expect(authorize('client-id')).resolves.toBe('per-file-token');
    expect(tokenConfig?.scope).toBe('https://www.googleapis.com/auth/drive.file');
    expect(tokenConfig?.include_granted_scopes).toBe(false);
  });

  it('returns the spreadsheet selected in Google Picker', async () => {
    let callback: ((data: GooglePickerResponse) => void) | undefined;

    class PickerBuilder {
      addView() { return this; }
      setOAuthToken() { return this; }
      setDeveloperKey() { return this; }
      setAppId() { return this; }
      setTitle() { return this; }
      setCallback(next: (data: GooglePickerResponse) => void) { callback = next; return this; }
      build() {
        return { setVisible: () => callback?.({ action: 'picked', docs: [{ id: 'sheet-1', name: 'Characters' }] }) };
      }
    }

    window.google = {
      accounts: { oauth2: { initTokenClient: vi.fn(), revoke: vi.fn() } },
      picker: {
        Action: { PICKED: 'picked', CANCEL: 'cancel' },
        ViewId: { SPREADSHEETS: 'spreadsheets' },
        DocsView: class {},
        PickerBuilder,
      },
    };

    await expect(pickSpreadsheet({ accessToken: 'token', apiKey: 'key', appId: '123' }))
      .resolves.toEqual({ id: 'sheet-1', name: 'Characters' });
  });
});
