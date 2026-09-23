<script lang="ts">
  import { readConfig } from './lib/config';
  import { DataValidationError } from './lib/domain';
  import { authorize, revoke } from './lib/googleAuth';
  import { SheetApiError, SheetsRepository } from './lib/sheetsRepository';
  import type { CharacterInput, CharacterViewModel, ClassRow } from './lib/types';

  const config = readConfig();
  let accessToken = '';
  let characters: CharacterViewModel[] = [];
  let classes: ClassRow[] = [];
  let selectedId = '';
  let mode: 'view' | 'create' | 'edit' = 'view';
  let busy = false;
  let errorMessage = '';
  let successMessage = '';

  const emptyForm = (): CharacterInput => ({
    name: '', level: 1, classId: '', vigor: 10, mind: 10, endurance: 10, notes: '',
  });
  let form = emptyForm();

  $: selected = characters.find((character) => character.id === selectedId) ?? null;

  function repository(): SheetsRepository {
    if (!config || !accessToken) throw new Error('Googleに接続されていません。');
    return new SheetsRepository(config.spreadsheetId, () => accessToken);
  }

  function clearMessages(): void {
    errorMessage = '';
    successMessage = '';
  }

  function handleError(error: unknown): void {
    if (error instanceof SheetApiError && error.kind === 'unauthorized') accessToken = '';
    errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました。';
  }

  async function connect(): Promise<void> {
    if (!config) return;
    clearMessages();
    busy = true;
    try {
      accessToken = await authorize(config.googleClientId);
      await refresh();
      successMessage = 'Google スプレッドシートに接続しました。';
    } catch (error) {
      accessToken = '';
      handleError(error);
    } finally {
      busy = false;
    }
  }

  async function disconnect(): Promise<void> {
    const token = accessToken;
    accessToken = '';
    characters = [];
    classes = [];
    selectedId = '';
    mode = 'view';
    clearMessages();
    if (token) await revoke(token);
  }

  async function refresh(): Promise<void> {
    clearMessages();
    busy = true;
    try {
      const data = await repository().listCharacters();
      characters = data.characters;
      classes = data.classes;
      if (selectedId && !characters.some((character) => character.id === selectedId)) selectedId = '';
      if (!selectedId && characters.length) selectedId = characters[0].id;
    } catch (error) {
      handleError(error);
    } finally {
      busy = false;
    }
  }

  function startCreate(): void {
    clearMessages();
    form = { ...emptyForm(), classId: classes[0]?.id ?? '' };
    mode = 'create';
  }

  function startEdit(): void {
    if (!selected) return;
    clearMessages();
    form = {
      id: selected.id,
      name: selected.name,
      level: selected.level,
      classId: selected.classId,
      vigor: selected.vigor,
      mind: selected.mind,
      endurance: selected.endurance,
      notes: selected.notes,
    };
    mode = 'edit';
  }

  function cancelForm(): void {
    clearMessages();
    mode = 'view';
  }

  async function save(): Promise<void> {
    clearMessages();
    busy = true;
    const isNew = mode === 'create';
    const id = isNew ? crypto.randomUUID() : form.id;
    try {
      if (isNew) await repository().createCharacter({ ...form, id });
      else await repository().updateCharacter(form);
      selectedId = id ?? '';
      mode = 'view';
      await refresh();
      successMessage = isNew ? 'キャラクターを保存しました。' : 'キャラクターを更新しました。';
    } catch (error) {
      if (error instanceof DataValidationError || error instanceof SheetApiError || error instanceof Error) {
        handleError(error);
      } else {
        handleError(new Error('保存に失敗しました。'));
      }
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>褪せ人の記録庫 | ELDEN RING TRPG</title>
</svelte:head>

<header class="site-header">
  <div class="brand-mark" aria-hidden="true">ER</div>
  <div>
    <p class="eyebrow">ELDEN RING TRPG</p>
    <h1>褪せ人の記録庫</h1>
  </div>
  {#if accessToken}
    <button class="button button--quiet header-action" type="button" on:click={disconnect}>切断</button>
  {/if}
</header>

<main class="app-shell">
  {#if !config}
    <section class="setup-panel" aria-labelledby="setup-title">
      <p class="eyebrow">SETUP REQUIRED</p>
      <h2 id="setup-title">Google Sheets の設定が必要です</h2>
      <p>プロジェクト直下に <code>.env.local</code> を作り、次の2項目を設定してください。</p>
      <pre>VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_SPREADSHEET_ID=...</pre>
      <p class="muted">詳しいGoogle Cloudとスプレッドシートの準備手順はREADMEにあります。</p>
    </section>
  {:else if !accessToken}
    <section class="welcome-panel" aria-labelledby="welcome-title">
      <div class="welcome-copy">
        <p class="eyebrow">SHARED ARCHIVE</p>
        <h2 id="welcome-title">冒険の記録を、<br />ひとつの場所に。</h2>
        <p>卓メンバーに共有されたGoogleスプレッドシートから、キャラクターを閲覧・保存します。</p>
        <button class="button button--primary" type="button" disabled={busy} on:click={connect}>
          {busy ? '接続しています…' : 'Googleに接続'}
        </button>
        <p class="fine-print">認証情報はブラウザのメモリにのみ保持され、ページを閉じると破棄されます。</p>
      </div>
      <div class="rune" aria-hidden="true"><span></span></div>
    </section>
  {:else}
    <div class="toolbar">
      <div>
        <p class="eyebrow">CHARACTER ARCHIVE</p>
        <p class="toolbar-count">{characters.length} 人の褪せ人</p>
      </div>
      <div class="toolbar-actions">
        <button class="button button--quiet" type="button" disabled={busy} on:click={refresh}>再読込</button>
        <button class="button button--primary" type="button" disabled={busy || !classes.length} on:click={startCreate}>新しい記録</button>
      </div>
    </div>

    {#if errorMessage}
      <div class="notice notice--error" role="alert">{errorMessage}</div>
    {/if}
    {#if successMessage}
      <div class="notice notice--success" role="status">{successMessage}</div>
    {/if}

    <div class="workspace" aria-busy={busy}>
      <aside class="character-list" aria-label="キャラクター一覧">
        {#if !characters.length && !busy}
          <div class="empty-state">
            <p>記録はまだありません。</p>
            <button class="text-button" type="button" disabled={!classes.length} on:click={startCreate}>最初のキャラクターを作成</button>
          </div>
        {/if}
        {#each characters as character (character.id)}
          <button
            class:active={character.id === selectedId}
            class="character-list-item"
            type="button"
            on:click={() => { selectedId = character.id; mode = 'view'; clearMessages(); }}
          >
            <span class="character-list-level">LV. {character.level}</span>
            <strong>{character.name}</strong>
            <span>{character.classInfo?.name ?? '不明な素性'}</span>
          </button>
        {/each}
      </aside>

      <section class="sheet-panel">
        {#if mode === 'create' || mode === 'edit'}
          <form class="character-form" on:submit|preventDefault={save}>
            <div class="panel-heading">
              <div>
                <p class="eyebrow">{mode === 'create' ? 'NEW RECORD' : 'EDIT RECORD'}</p>
                <h2>{mode === 'create' ? '新しい褪せ人' : '記録を編集'}</h2>
              </div>
            </div>

            <div class="form-grid">
              <label class="field field--wide">
                <span>名前</span>
                <input bind:value={form.name} required maxlength="80" autocomplete="off" />
              </label>
              <label class="field">
                <span>レベル</span>
                <input bind:value={form.level} type="number" min="1" step="1" required />
              </label>
              <label class="field">
                <span>素性</span>
                <select bind:value={form.classId} required>
                  <option value="" disabled>選択してください</option>
                  {#each classes as classRow}
                    <option value={classRow.id}>{classRow.name}</option>
                  {/each}
                </select>
              </label>
              <label class="field">
                <span>生命力</span>
                <input bind:value={form.vigor} type="number" min="1" step="1" required />
              </label>
              <label class="field">
                <span>精神力</span>
                <input bind:value={form.mind} type="number" min="1" step="1" required />
              </label>
              <label class="field">
                <span>持久力</span>
                <input bind:value={form.endurance} type="number" min="1" step="1" required />
              </label>
              <label class="field field--full">
                <span>備考</span>
                <textarea bind:value={form.notes} rows="5" maxlength="2000"></textarea>
              </label>
            </div>
            <div class="form-actions">
              <button class="button button--quiet" type="button" disabled={busy} on:click={cancelForm}>キャンセル</button>
              <button class="button button--primary" type="submit" disabled={busy}>{busy ? '保存中…' : '保存する'}</button>
            </div>
          </form>
        {:else if selected}
          <article class="character-sheet">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">CHARACTER RECORD</p>
                <h2>{selected.name}</h2>
                <p class="character-subtitle">LV. {selected.level} · {selected.classInfo?.name ?? '不明な素性'}</p>
              </div>
              <button class="button button--quiet" type="button" on:click={startEdit}>編集</button>
            </div>

            {#if !selected.classInfo}
              <div class="notice notice--warning" role="status">
                classId「{selected.classId}」に対応する素性が Classes シートにありません。
              </div>
            {/if}

            <div class="stats" aria-label="能力値">
              <div class="stat"><span>生命力</span><strong>{selected.vigor}</strong></div>
              <div class="stat"><span>精神力</span><strong>{selected.mind}</strong></div>
              <div class="stat"><span>持久力</span><strong>{selected.endurance}</strong></div>
              <div class="stat stat--derived">
                <span>ガード</span><strong>{selected.guard ?? '—'}</strong>
                <small>⌊持久力 ÷ 4⌋ + 素性補正</small>
              </div>
            </div>

            <section class="record-section">
              <h3>素性</h3>
              <p>{selected.classInfo?.description || '説明は登録されていません。'}</p>
            </section>
            <section class="record-section">
              <h3>備考</h3>
              <p class:muted={!selected.notes}>{selected.notes || '備考はありません。'}</p>
            </section>
            <p class="updated-at">最終更新: {selected.updatedAt || '不明'}</p>
          </article>
        {:else}
          <div class="empty-detail">
            <div aria-hidden="true">✦</div>
            <p>左の一覧から記録を選択してください。</p>
          </div>
        {/if}
      </section>
    </div>
  {/if}
</main>

<footer class="site-footer">A minimal proof of concept · Data stored in Google Sheets</footer>
