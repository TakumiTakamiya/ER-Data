export interface AppConfig {
  googleClientId: string;
  spreadsheetId: string;
  googleApiKey: string;
  googleAppId: string;
}

export function readConfig(env: ImportMetaEnv = import.meta.env): AppConfig | null {
  const googleClientId = env.VITE_GOOGLE_CLIENT_ID?.trim();
  const spreadsheetId = env.VITE_GOOGLE_SPREADSHEET_ID?.trim();
  const googleApiKey = env.VITE_GOOGLE_API_KEY?.trim();
  const googleAppId = env.VITE_GOOGLE_APP_ID?.trim();

  return googleClientId && spreadsheetId && googleApiKey && googleAppId
    ? { googleClientId, spreadsheetId, googleApiKey, googleAppId }
    : null;
}
