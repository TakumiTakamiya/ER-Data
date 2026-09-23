import { describe, expect, it } from 'vitest';
import { readConfig } from './config';

describe('readConfig', () => {
  const complete = {
    VITE_GOOGLE_CLIENT_ID: 'client-id',
    VITE_GOOGLE_SPREADSHEET_ID: 'spreadsheet-id',
    VITE_GOOGLE_API_KEY: 'api-key',
    VITE_GOOGLE_APP_ID: '1234567890',
  } as ImportMetaEnv;

  it('returns the four Google configuration values', () => {
    expect(readConfig(complete)).toEqual({
      googleClientId: 'client-id',
      spreadsheetId: 'spreadsheet-id',
      googleApiKey: 'api-key',
      googleAppId: '1234567890',
    });
  });

  it('returns null when Picker configuration is missing', () => {
    expect(readConfig({
      ...complete,
      VITE_GOOGLE_API_KEY: '',
    } as ImportMetaEnv)).toBeNull();
  });
});
