const GOOGLE_API_URL = 'https://apis.google.com/js/api.js';

let pickerPromise: Promise<void> | null = null;

function loadPickerApi(): Promise<void> {
  if (window.google?.picker) return Promise.resolve();
  if (pickerPromise) return pickerPromise;

  pickerPromise = new Promise((resolve, reject) => {
    const loadModule = () => {
      if (!window.gapi) {
        reject(new Error('Google Pickerライブラリを初期化できませんでした。'));
        return;
      }
      window.gapi.load('picker', {
        callback: resolve,
        onerror: () => reject(new Error('Google Pickerを読み込めませんでした。')),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_API_URL}"]`);
    if (existing) {
      if (window.gapi) loadModule();
      else {
        existing.addEventListener('load', loadModule, { once: true });
        existing.addEventListener('error', () => reject(new Error('Google APIライブラリを読み込めませんでした。')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_API_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', loadModule, { once: true });
    script.addEventListener('error', () => reject(new Error('Google APIライブラリを読み込めませんでした。')), { once: true });
    document.head.appendChild(script);
  });

  return pickerPromise;
}

export interface PickerOptions {
  accessToken: string;
  apiKey: string;
  appId: string;
}

export async function pickSpreadsheet(options: PickerOptions): Promise<GooglePickerDocument> {
  await loadPickerApi();
  const picker = window.google?.picker;
  if (!picker) throw new Error('Google Pickerを初期化できませんでした。');

  return new Promise((resolve, reject) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS);
    const dialog = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(options.accessToken)
      .setDeveloperKey(options.apiKey)
      .setAppId(options.appId)
      .setTitle('このアプリで使用するキャラクターシートを選択')
      .setCallback((data) => {
        if (data.action === picker.Action.CANCEL) {
          reject(new Error('スプレッドシートの選択がキャンセルされました。'));
          return;
        }
        if (data.action !== picker.Action.PICKED) return;
        const document = data.docs?.[0];
        if (!document?.id) {
          reject(new Error('選択したスプレッドシートを確認できませんでした。'));
          return;
        }
        resolve(document);
      })
      .build();
    dialog.setVisible(true);
  });
}
