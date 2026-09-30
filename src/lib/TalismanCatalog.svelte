<script lang="ts">
  import { deleteJson, getJson, sendJson } from './api';
  import type { TalismanDetail } from './types';

  export let onNavigate: (path: string) => void = () => {};
  export let onChanged: () => void = () => {};

  let talismans: TalismanDetail[] = [];
  let selected: TalismanDetail | null = null;
  let query = '';
  let editing = false;
  let busy = false;
  let errorMessage = '';
  let successMessage = '';
  let form = { name: '', effect: '' };

  $: normalizedQuery = query.trim().toLocaleLowerCase();
  $: filtered = talismans.filter((talisman) => !normalizedQuery || [talisman.name, talisman.effect].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));

  function selectTalisman(talisman: TalismanDetail) { selected=talisman;editing=false;errorMessage='';successMessage=''; }
  function beginEdit() { if(!selected)return;form={name:selected.name,effect:selected.effect};editing=true; }
  async function load(preferredId?:number){busy=true;errorMessage='';try{talismans=await getJson<TalismanDetail[]>('/api/admin/talismans');selected=talismans.find((talisman)=>talisman.id===(preferredId??selected?.id))??talismans[0]??null;}catch(error){errorMessage=error instanceof Error?error.message:'タリスマン一覧を取得できませんでした。';}finally{busy=false;}}
  async function save(){if(!selected)return;busy=true;errorMessage='';successMessage='';try{await sendJson(`/api/admin/talismans/${selected.id}`,'PUT',form);const id=selected.id;await load(id);editing=false;successMessage='タリスマンを更新しました。';onChanged();}catch(error){errorMessage=error instanceof Error?error.message:'タリスマンを更新できませんでした。';}finally{busy=false;}}
  async function remove(){if(!selected||!window.confirm(`タリスマン「${selected.name}」を削除しますか？\n冒険の所持品・キャラクターの装備との関連付けも解除されます。`))return;busy=true;errorMessage='';successMessage='';try{const name=selected.name;await deleteJson(`/api/admin/talismans/${selected.id}`);selected=null;editing=false;await load();successMessage=`タリスマン「${name}」を削除しました。`;onChanged();}catch(error){errorMessage=error instanceof Error?error.message:'タリスマンを削除できませんでした。';}finally{busy=false;}}

  void load();
</script>

{#if errorMessage}<div class="notice notice--error" role="alert">{errorMessage}</div>{/if}
{#if successMessage}<div class="notice notice--success" role="status">{successMessage}</div>{/if}
<div class="toolbar"><div><p class="eyebrow">MASTER DATA</p><h2>タリスマン一覧</h2><p class="muted">{filtered.length} / {talismans.length} 件</p></div><div class="toolbar-actions"><button class="button button--quiet" onclick={()=>onNavigate('/admin/')}>管理メニュー</button><button class="button button--primary" onclick={()=>onNavigate('/admin/talismans/new')}>新規追加</button></div></div>
<label class="field skill-search"><span>タリスマンを検索</span><input type="search" bind:value={query} placeholder="名前・効果で検索"></label>
<div class="skill-catalog">
  <aside class="card skill-catalog__list" aria-label="タリスマン一覧">{#each filtered as talisman}<button class:active={selected?.id===talisman.id} onclick={()=>selectTalisman(talisman)}><strong>{talisman.name}</strong><span>{talisman.effect||'効果なし'}</span></button>{/each}{#if !filtered.length&&!busy}<p class="empty-state">該当するタリスマンはありません。</p>{/if}</aside>
  <section class="card skill-catalog__detail">
    {#if busy&&!selected}<div class="loading">読み込んでいます…</div>
    {:else if selected&&!editing}<div class="panel-heading"><div><p class="eyebrow">TALISMAN DETAIL</p><h2>{selected.name}</h2></div><div class="toolbar-actions"><button class="button button--quiet" onclick={beginEdit}>編集</button><button class="button button--danger" onclick={()=>void remove()} disabled={busy}>削除</button></div></div><section class="record-section"><h3>効果</h3><p>{selected.effect||'なし'}</p></section>
    {:else if selected}<form onsubmit={(event)=>{event.preventDefault();void save();}}><div class="panel-heading"><div><p class="eyebrow">EDIT TALISMAN</p><h2>{selected.name}</h2></div></div><div class="form-grid"><label class="field field--wide"><span>名前</span><input bind:value={form.name} required></label><label class="field field--full"><span>効果</span><textarea rows="8" bind:value={form.effect} required></textarea></label></div><div class="form-actions"><button type="button" class="button button--quiet" onclick={()=>editing=false}>キャンセル</button><button class="button button--primary" disabled={busy}>保存する</button></div></form>
    {:else}<div class="empty-detail"><div>◇</div><p>タリスマンを選択してください。</p></div>{/if}
  </section>
</div>
