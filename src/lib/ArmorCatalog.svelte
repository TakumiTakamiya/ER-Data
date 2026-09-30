<script lang="ts">
  import SkillTransfer from './SkillTransfer.svelte';
  import { deleteJson, getJson, sendJson } from './api';
  import type { AdminOptions, ArmorDetail } from './types';

  export let options: AdminOptions | null = null;
  export let onNavigate: (path: string) => void = () => {};
  export let onChanged: () => void = () => {};

  let armors: ArmorDetail[] = [];
  let selected: ArmorDetail | null = null;
  let query = '';
  let editing = false;
  let busy = false;
  let errorMessage = '';
  let successMessage = '';
  let form = emptyForm();

  $: normalizedQuery = query.trim().toLocaleLowerCase();
  $: filtered = armors.filter((armor) => !normalizedQuery || [armor.name, armor.slot === 'HEAD' ? '頭' : '胴体', armor.armorSet?.name ?? '', ...armor.skills.map((skill) => skill.name)].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));

  function emptyForm() { return { name: '', slot: 'HEAD' as 'HEAD'|'BODY', armorSetId: null as number|null, weight: 0, physicalCut: 0, phenomenonCut: 0, poise: 0, skillIds: [] as number[] }; }
  function selectArmor(armor: ArmorDetail) { selected = armor; editing = false; errorMessage = ''; successMessage = ''; }
  function beginEdit() { if (!selected) return; form = { name:selected.name,slot:selected.slot,armorSetId:selected.armorSet?.id??null,weight:selected.weight,physicalCut:selected.physicalCut,phenomenonCut:selected.phenomenonCut,poise:selected.poise,skillIds:selected.skills.map((skill)=>skill.id) }; editing = true; }
  async function load(preferredId?:number) { busy=true;errorMessage='';try{armors=await getJson<ArmorDetail[]>('/api/admin/armors');selected=armors.find((armor)=>armor.id===(preferredId??selected?.id))??armors[0]??null;}catch(error){errorMessage=error instanceof Error?error.message:'防具一覧を取得できませんでした。';}finally{busy=false;} }
  async function save(){if(!selected)return;busy=true;errorMessage='';successMessage='';try{await sendJson(`/api/admin/armors/${selected.id}`,'PUT',form);const id=selected.id;await load(id);editing=false;successMessage='防具を更新しました。';onChanged();}catch(error){errorMessage=error instanceof Error?error.message:'防具を更新できませんでした。';}finally{busy=false;}}
  async function remove(){if(!selected||!window.confirm(`防具「${selected.name}」を削除しますか？\n素性・キャラクター・冒険との関連付けも解除されます。`))return;busy=true;errorMessage='';successMessage='';try{const name=selected.name;await deleteJson(`/api/admin/armors/${selected.id}`);selected=null;editing=false;await load();successMessage=`防具「${name}」を削除しました。`;onChanged();}catch(error){errorMessage=error instanceof Error?error.message:'防具を削除できませんでした。';}finally{busy=false;}}

  void load();
</script>

{#if errorMessage}<div class="notice notice--error" role="alert">{errorMessage}</div>{/if}
{#if successMessage}<div class="notice notice--success" role="status">{successMessage}</div>{/if}
<div class="toolbar"><div><p class="eyebrow">MASTER DATA</p><h2>防具一覧</h2><p class="muted">{filtered.length} / {armors.length} 件</p></div><div class="toolbar-actions"><button class="button button--quiet" onclick={()=>onNavigate('/admin/')}>管理メニュー</button><button class="button button--primary" onclick={()=>onNavigate('/admin/armors/new')}>新規追加</button></div></div>
<label class="field skill-search"><span>防具を検索</span><input type="search" bind:value={query} placeholder="名前・部位・防具セット・装備スキルで検索"></label>
<div class="skill-catalog">
  <aside class="card skill-catalog__list" aria-label="防具一覧">{#each filtered as armor}<button class:active={selected?.id===armor.id} onclick={()=>selectArmor(armor)}><strong>{armor.name}</strong><span>{armor.slot==='HEAD'?'頭':'胴体'} · {armor.armorSet?.name??'セットなし'}</span></button>{/each}{#if !filtered.length&&!busy}<p class="empty-state">該当する防具はありません。</p>{/if}</aside>
  <section class="card skill-catalog__detail">
    {#if busy&&!selected}<div class="loading">読み込んでいます…</div>
    {:else if selected&&!editing}<div class="panel-heading"><div><p class="eyebrow">ARMOR DETAIL</p><h2>{selected.name}</h2></div><div class="toolbar-actions"><button class="button button--quiet" onclick={beginEdit}>編集</button><button class="button button--danger" onclick={()=>void remove()} disabled={busy}>削除</button></div></div><dl class="armor-detail-grid"><div><dt>部位</dt><dd>{selected.slot==='HEAD'?'頭':'胴体'}</dd></div><div><dt>重量</dt><dd>{selected.weight}</dd></div><div><dt>物理カット</dt><dd>{selected.physicalCut}</dd></div><div><dt>現象カット</dt><dd>{selected.phenomenonCut}</dd></div><div><dt>強靭値</dt><dd>{selected.poise}</dd></div><div><dt>防具セット</dt><dd>{selected.armorSet?.name??'なし'}</dd></div></dl><section class="record-section"><h3>装備スキル</h3><p>{selected.skills.map((skill)=>skill.name).join('、')||'なし'}</p></section>
    {:else if selected}<form onsubmit={(event)=>{event.preventDefault();void save();}}><div class="panel-heading"><div><p class="eyebrow">EDIT ARMOR</p><h2>{selected.name}</h2></div></div><div class="form-grid"><label class="field field--wide"><span>名前</span><input bind:value={form.name} required></label><label class="field"><span>部位</span><select bind:value={form.slot}><option value="HEAD">頭</option><option value="BODY">胴体</option></select></label><label class="field"><span>重量</span><input type="number" min="0" bind:value={form.weight}></label><label class="field"><span>物理カット</span><input type="number" bind:value={form.physicalCut}></label><label class="field"><span>現象カット</span><input type="number" bind:value={form.phenomenonCut}></label><label class="field"><span>強靭値</span><input type="number" bind:value={form.poise}></label><label class="field"><span>防具セット</span><select bind:value={form.armorSetId}><option value={null}>なし</option>{#each options?.armorSets??[] as armorSet}<option value={armorSet.id}>{armorSet.name}</option>{/each}</select></label></div><h3>装備スキル</h3><SkillTransfer skills={options?.skills??[]} selectedIds={form.skillIds} onChange={(value)=>{form.skillIds=value.map(Number);form={...form};}}/><div class="form-actions"><button type="button" class="button button--quiet" onclick={()=>editing=false}>キャンセル</button><button class="button button--primary" disabled={busy}>保存する</button></div></form>
    {:else}<div class="empty-detail"><div>◇</div><p>防具を選択してください。</p></div>{/if}
  </section>
</div>
