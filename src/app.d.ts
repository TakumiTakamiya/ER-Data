/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_SPREADSHEET_ID?: string;
  readonly VITE_GOOGLE_API_KEY?: string;
  readonly VITE_GOOGLE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(config: {
          client_id: string;
          scope: string;
          include_granted_scopes?: boolean;
          callback: (response: GoogleTokenResponse) => void;
          error_callback?: (error: { type?: string; message?: string }) => void;
        }): GoogleTokenClient;
        revoke(token: string, callback?: () => void): void;
      };
    };
    picker?: GooglePickerNamespace;
  };
  gapi?: {
    load(api: string, options: { callback: () => void; onerror: () => void }): void;
  };
}

interface GooglePickerDocument {
  id?: string;
  name?: string;
}

interface GooglePickerResponse {
  action?: string;
  docs?: GooglePickerDocument[];
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setAppId(appId: string): GooglePickerBuilder;
  setCallback(callback: (data: GooglePickerResponse) => void): GooglePickerBuilder;
  setTitle(title: string): GooglePickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

interface GooglePickerNamespace {
  Action: { PICKED: string; CANCEL: string };
  ViewId: { SPREADSHEETS: string };
  DocsView: new (viewId: string) => unknown;
  PickerBuilder: new () => GooglePickerBuilder;
}
