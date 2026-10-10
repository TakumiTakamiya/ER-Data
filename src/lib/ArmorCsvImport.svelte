<script lang="ts">
  import { sendJson } from './api';
  import { parseArmorCsv, type ArmorCsvRow } from './armorCsv';

  export let onImported: (result: { armorSets: number; armors: number }) => void = () => {};
  let rows: ArmorCsvRow[] = [];
  let fileName = '';
  let errorMessage = '';
  let busy = false;

  async function decodeFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { return new TextDecoder('shift_jis').decode(buffer); }
  }

  async function selectFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    rows = []; errorMessage = ''; fileName = file?.name ?? '';
    if (!file) return;
    try { rows = parseArmorCsv(await decodeFile(file)); }
    catch (error) { errorMessage = error instanceof Error ? error.message : 'CSVを読み込めませんでした。'; }
  }

  async function importRows() {
    if (!rows.length) return;
    busy = true; errorMessage = '';
    try {
      const result = await sendJson<{ armorSets: number; armors: number }>('/api/admin/armors/import', 'POST', { rows });
      rows = []; fileName = '';
      onImported(result);
    } catch (error) { errorMessage = error instanceof Error ? error.message : '一括登録に失敗しました。'; }
    finally { busy = false; }
  }
</script>

<section class="card armor-csv-import" aria-labelledby="armor-csv-title">
  <div>
    <p class="eyebrow">CSV IMPORT</p>
    <h2 id="armor-csv-title">CSVから一括登録</h2>
    <p class="muted">指定形式のCSVから、防具セットと頭・胴防具をまとめて登録します。装備スキルはスキルマスターと紐付けず、各防具の簡易スキルとして保存します。</p>
  </div>
  <label class="field field--wide"><span>CSVファイル（UTF-8 / Shift_JIS）</span><input type="file" accept=".csv,text/csv" onchange={(event)=>void selectFile(event)} disabled={busy}></label>
  {#if errorMessage}<div class="notice notice--error" role="alert">{errorMessage}</div>{/if}
  {#if rows.length}
    <div class="armor-csv-preview">
      <strong>{fileName}</strong><span>{rows.length}シリーズ / {rows.length * 2}防具</span>
      <p>{rows.slice(0, 3).map(row=>row.seriesName).join('、')}{rows.length > 3 ? `、ほか${rows.length - 3}件` : ''}</p>
    </div>
    <p class="muted">同名のシリーズまたは防具が登録済みの場合、CSV全体を登録せずに終了します。</p>
    <div class="form-actions"><button type="button" class="button button--primary" onclick={()=>void importRows()} disabled={busy}>{busy ? '登録中…' : `${rows.length}シリーズを一括登録`}</button></div>
  {/if}
</section>
