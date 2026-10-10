<script lang="ts">
  import SkillTransfer from './SkillTransfer.svelte';
  import { deleteJson, getJson, sendJson } from './api';
  import type { AdminOptions, ArmorSetSummary } from './types';

  export let options: AdminOptions | null = null;
  export let onNavigate: (path: string) => void = () => {};
  export let onChanged: () => void = () => {};

  let armorSets: ArmorSetSummary[] = [];
  let selected: ArmorSetSummary | null = null;
  let query = '';
  let editing = false;
  let busy = false;
  let errorMessage = '';
  let successMessage = '';
  let form = { name: '', seriesEffect: '', skillIds: [] as number[] };

  $: normalizedQuery = query.trim().toLocaleLowerCase();
  $: filtered = armorSets.filter((armorSet) => !normalizedQuery || [armorSet.name, armorSet.seriesEffect, ...armorSet.skills.map((skill) => skill.name)].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));

  function selectArmorSet(armorSet: ArmorSetSummary) { selected = armorSet; editing = false; errorMessage = ''; successMessage = ''; }
  function beginEdit() { if (!selected) return; form = { name:selected.name,seriesEffect:selected.seriesEffect,skillIds:selected.skills.map((skill)=>skill.id) }; editing = true; }
  async function load(preferredId?:number) { busy=true;errorMessage='';try{armorSets=await getJson<ArmorSetSummary[]>('/api/admin/armor-sets');selected=armorSets.find((armorSet)=>armorSet.id===(preferredId??selected?.id))??armorSets[0]??null;}catch(error){errorMessage=error instanceof Error?error.message:'防具セット一覧を取得できませんでした。';}finally{busy=false;} }
  async function save(){if(!selected)return;busy=true;errorMessage='';successMessage='';try{await sendJson(`/api/admin/armor-sets/${selected.id}`,'PUT',form);const id=selected.id;await load(id);editing=false;successMessage='防具セットを更新しました。';onChanged();}catch(error){errorMessage=error instanceof Error?error.message:'防具セットを更新できませんでした。';}finally{busy=false;}}
  async function remove(){if(!selected||!window.confirm(`防具セット「${selected.name}」を削除しますか？\nこのセットを使っている防具は、セット未指定になります。`))return;busy=true;errorMessage='';successMessage='';try{const name=selected.name;await deleteJson(`/api/admin/armor-sets/${selected.id}`);selected=null;editing=false;await load();successMessage=`防具セット「${name}」を削除しました。`;onChanged();}catch(error){errorMessage=error instanceof Error?error.message:'防具セットを削除できませんでした。';}finally{busy=false;}}

  void load();
</script>

{#if errorMessage}<div class="notice notice--error" role="alert">{errorMessage}</div>{/if}
{#if successMessage}<div class="notice notice--success" role="status">{successMessage}</div>{/if}
<div class="toolbar"><div><p class="eyebrow">MASTER DATA</p><h2>防具セット一覧</h2><p class="muted">{filtered.length} / {armorSets.length} 件</p></div><div class="toolbar-actions"><button class="button button--quiet" onclick={()=>onNavigate('/admin/')}>管理メニュー</button><button class="button button--primary" onclick={()=>onNavigate('/admin/armor-sets/new')}>新規追加</button></div></div>
<label class="field skill-search"><span>防具セットを検索</span><input type="search" bind:value={query} placeholder="名前・シリーズ効果・装備スキルで検索"></label>
<div class="skill-catalog">
  <aside class="card skill-catalog__list" aria-label="防具セット一覧">{#each filtered as armorSet}<button class:active={selected?.id===armorSet.id} onclick={()=>selectArmorSet(armorSet)}><strong>{armorSet.name}</strong><span>所属防具 {armorSet.armorCount} 件 · 装備スキル {armorSet.skillCount} 件</span></button>{/each}{#if !filtered.length&&!busy}<p class="empty-state">該当する防具セットはありません。</p>{/if}</aside>
  <section class="card skill-catalog__detail">
    {#if busy&&!selected}<div class="loading">読み込んでいます…</div>
    {:else if selected&&!editing}<div class="panel-heading"><div><p class="eyebrow">ARMOR SET DETAIL</p><h2>{selected.name}</h2></div><div class="toolbar-actions"><button class="button button--quiet" onclick={beginEdit}>編集</button><button class="button button--danger" onclick={()=>void remove()} disabled={busy}>削除</button></div></div><section class="record-section"><h3>シリーズ効果</h3><p>{selected.seriesEffect||'なし'}</p></section><section class="record-section"><h3>装備スキル</h3><p>{selected.skills.map((skill)=>skill.name).join('、')||'なし'}</p></section><p class="muted">所属防具 {selected.armorCount} 件</p>
    {:else if selected}<form onsubmit={(event)=>{event.preventDefault();void save();}}><div class="panel-heading"><div><p class="eyebrow">EDIT ARMOR SET</p><h2>{selected.name}</h2></div></div><div class="form-grid"><label class="field field--wide"><span>名前</span><input bind:value={form.name} required></label><label class="field field--full"><span>シリーズ効果</span><textarea rows="6" bind:value={form.seriesEffect}></textarea></label></div><h3>装備スキル</h3><SkillTransfer skills={options?.skills??[]} selectedIds={form.skillIds} onChange={(value)=>{form.skillIds=value.map(Number);form={...form};}}/><div class="form-actions"><button type="button" class="button button--quiet" onclick={()=>editing=false}>キャンセル</button><button class="button button--primary" disabled={busy}>保存する</button></div></form>
    {:else}<div class="empty-detail"><div>◇</div><p>防具セットを選択してください。</p></div>{/if}
  </section>
</div>
