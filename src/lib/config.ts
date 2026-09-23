export interface AppConfig {
  googleClientId: string;
  spreadsheetId: string;
}

export function readConfig(env: ImportMetaEnv = import.meta.env): AppConfig | null {
  const googleClientId = env.VITE_GOOGLE_CLIENT_ID?.trim();
  const spreadsheetId = env.VITE_GOOGLE_SPREADSHEET_ID?.trim();

  return googleClientId && spreadsheetId ? { googleClientId, spreadsheetId } : null;
}
