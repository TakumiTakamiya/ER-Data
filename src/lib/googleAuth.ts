const GIS_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let scriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_URL}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Google認証ライブラリを読み込めませんでした。')), { once: true });
    if (!existing) {
      script.src = GIS_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

export async function authorize(clientId: string): Promise<string> {
  await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    const google = window.google;
    if (!google) return reject(new Error('Google認証を初期化できませんでした。'));

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      // Do not fold a previously granted broad Sheets scope into this token.
      include_granted_scopes: false,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || 'Google認可が完了しませんでした。'));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error) => reject(new Error(error.message || 'Google認可画面が閉じられました。')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export function revoke(token: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.google) return resolve();
    window.google.accounts.oauth2.revoke(token, resolve);
  });
}
