<script lang="ts">
  import SkillTransfer from './SkillTransfer.svelte';
  import { deleteJson, getJson, sendJson } from './api';
  import { applyCostShortcut, type CostShortcut } from './skillForm';
  import { combinedCategoryOptions, combinedCategorySelection, splitCategorySelection } from './skillCategorySelection';
  import type { AdminOptions, SkillDetail } from './types';

  export let options: AdminOptions | null = null;
  export let onNavigate: (path: string) => void = () => {};
  export let onChanged: () => void = () => {};

  let skills: SkillDetail[] = [];
  let selected: SkillDetail | null = null;
  let query = '';
  let editing = false;
  let busy = false;
  let errorMessage = '';
  let successMessage = '';
  let form = emptyForm();

  $: normalizedQuery = query.trim().toLocaleLowerCase();
  $: filtered = skills.filter((skill) => !normalizedQuery || [skill.name, skill.classification, skill.timing, skill.target].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));

  function emptyForm() {
    return { name: '', classification: '', timing: 'AC', target: '', cost: '', maxUses: null as number | null, rankEffects: ['', '', ''], categoryIds: [] as number[], shieldCategoryIds: [] as number[] };
  }
  function selectSkill(skill: SkillDetail) { selected = skill; editing = false; successMessage = ''; errorMessage = ''; }
  function beginEdit() {
    if (!selected) return;
    form = { name: selected.name, classification: selected.classification, timing: selected.timing, target: selected.target, cost: selected.cost, maxUses: selected.maxUses, rankEffects: [...selected.rankEffects], categoryIds: selected.weaponCategories.map((item) => item.id), shieldCategoryIds: selected.shieldCategories.map((item) => item.id) };
    editing = true;
  }
  function setCategories(values: Array<string | number>) { const split = splitCategorySelection(values); form.categoryIds = split.weaponCategoryIds; form.shieldCategoryIds = split.shieldCategoryIds; form = { ...form }; }
  function addCost(shortcut: CostShortcut) { form.cost = applyCostShortcut(form.cost, shortcut); form = { ...form }; }
  function prependRequiredAbility() { if (!form.rankEffects[0].startsWith('〔必要能力値：〕')) form.rankEffects[0] = `〔必要能力値：〕${form.rankEffects[0]}`; form = { ...form, rankEffects: [...form.rankEffects] }; }
  async function load(preferredId?: number) {
    busy = true; errorMessage = '';
    try { skills = await getJson<SkillDetail[]>('/api/admin/skills'); selected = skills.find((skill) => skill.id === (preferredId ?? selected?.id)) ?? skills[0] ?? null; }
    catch (error) { errorMessage = error instanceof Error ? error.message : 'スキル一覧を取得できませんでした。'; }
    finally { busy = false; }
  }
  async function save() {
    if (!selected) return;
    busy = true; errorMessage = ''; successMessage = '';
    try { await sendJson(`/api/admin/skills/${selected.id}`, 'PUT', form); const id = selected.id; await load(id); editing = false; successMessage = 'スキルを更新しました。'; onChanged(); }
    catch (error) { errorMessage = error instanceof Error ? error.message : 'スキルを更新できませんでした。'; }
    finally { busy = false; }
  }
  async function remove() {
    if (!selected || !window.confirm(`スキル「${selected.name}」を削除しますか？\nスキルセットや装備との関連付けも解除されます。`)) return;
    busy = true; errorMessage = ''; successMessage = '';
    try { const name = selected.name; await deleteJson(`/api/admin/skills/${selected.id}`); selected = null; editing = false; await load(); successMessage = `スキル「${name}」を削除しました。`; onChanged(); }
    catch (error) { errorMessage = error instanceof Error ? error.message : 'スキルを削除できませんでした。'; }
    finally { busy = false; }
  }

  void load();
</script>

{#if errorMessage}<div class="notice notice--error" role="alert">{errorMessage}</div>{/if}
{#if successMessage}<div class="notice notice--success" role="status">{successMessage}</div>{/if}
<div class="toolbar"><div><p class="eyebrow">MASTER DATA</p><h2>スキル一覧</h2><p class="muted">{filtered.length} / {skills.length} 件</p></div><div class="toolbar-actions"><button class="button button--quiet" onclick={()=>onNavigate('/admin/')}>管理メニュー</button><button class="button button--primary" onclick={()=>onNavigate('/admin/skills/new')}>新規追加</button></div></div>
<label class="field skill-search"><span>スキルを検索</span><input type="search" bind:value={query} placeholder="名前・分類・タイミング・対象で検索"></label>
<div class="skill-catalog">
  <aside class="card skill-catalog__list" aria-label="スキル一覧">{#each filtered as skill}<button class:active={selected?.id===skill.id} onclick={()=>selectSkill(skill)}><strong>{skill.name}</strong><span>{skill.classification} · {skill.timing}</span></button>{/each}{#if !filtered.length&&!busy}<p class="empty-state">該当するスキルはありません。</p>{/if}</aside>
  <section class="card skill-catalog__detail">
    {#if busy&&!selected}<div class="loading">読み込んでいます…</div>
    {:else if selected&&!editing}<div class="panel-heading"><div><p class="eyebrow">SKILL DETAIL</p><h2>{selected.name}</h2></div><div class="toolbar-actions"><button class="button button--quiet" onclick={beginEdit}>編集</button><button class="button button--danger" onclick={()=>void remove()} disabled={busy}>削除</button></div></div><dl class="skill-dialog__meta"><div><dt>分類</dt><dd>{selected.classification}</dd></div><div><dt>タイミング</dt><dd>{selected.timing}</dd></div><div><dt>対象</dt><dd>{selected.target}</dd></div><div><dt>コスト</dt><dd>{selected.cost}</dd></div><div><dt>最大使用回数</dt><dd>{selected.maxUses===null?'無制限':selected.maxUses}</dd></div></dl>{#each selected.rankEffects as effect,index}{#if effect}<section class="record-section"><h3>ランク {index+1}</h3><p>{effect}</p></section>{/if}{/each}<section class="record-section"><h3>対応する武器・盾カテゴリ</h3><p>{[...selected.weaponCategories,...selected.shieldCategories].map((item)=>item.name).join('、')||'指定なし'}</p></section>
    {:else if selected}<form onsubmit={(event)=>{event.preventDefault();void save();}}><div class="panel-heading"><div><p class="eyebrow">EDIT SKILL</p><h2>{selected.name}</h2></div></div><div class="form-grid"><label class="field field--wide"><span>名前</span><input bind:value={form.name} required></label><label class="field"><span>タイミング</span><select bind:value={form.timing}><option value="AC">Ac</option><option value="RE">Re</option><option value="TRIGGER">Trigger</option><option value="PASSIVE">Passive</option></select></label><label class="field"><span>最大使用回数（空欄は無制限）</span><input type="number" min="0" bind:value={form.maxUses}></label><label class="field field--wide"><span>分類</span><input bind:value={form.classification} required></label><label class="field field--wide"><span>対象</span><input bind:value={form.target} required></label><div class="field field--wide"><label><span>コスト</span><input bind:value={form.cost} required></label><div class="shortcut-row"><button type="button" class="shortcut-button" onclick={()=>addCost('dice')}>ダイス１個</button><button type="button" class="shortcut-button" onclick={()=>addCost('sequence')}>連番２個</button><button type="button" class="shortcut-button" onclick={()=>addCost('pair')}>ゾロ２個</button><button type="button" class="shortcut-button" onclick={()=>addCost('fp')}>FP■</button></div></div></div><h3>ランク効果</h3><div class="mini-grid">{#each [0,1,2] as rank}<label class="field"><span>ランク {rank+1}</span><textarea rows="4" bind:value={form.rankEffects[rank]}></textarea>{#if rank===0}<button type="button" class="shortcut-button field-shortcut" onclick={prependRequiredAbility}>先頭に「〔必要能力値：〕」を追加</button>{/if}</label>{/each}</div><h3>対応する武器・盾カテゴリ</h3><SkillTransfer itemLabel="武器・盾カテゴリ" skills={combinedCategoryOptions(options?.weaponCategories??[],options?.shieldCategories??[])} selectedIds={combinedCategorySelection(form.categoryIds,form.shieldCategoryIds)} onChange={setCategories}/><div class="form-actions"><button type="button" class="button button--quiet" onclick={()=>editing=false}>キャンセル</button><button class="button button--primary" disabled={busy}>保存する</button></div></form>
    {:else}<div class="empty-detail"><div>◇</div><p>スキルを選択してください。</p></div>{/if}
  </section>
</div>
