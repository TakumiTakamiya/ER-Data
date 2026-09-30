<script lang="ts">
  import { onMount } from 'svelte';
  import SkillTransfer from './lib/SkillTransfer.svelte';
  import GuardCutInput from './lib/GuardCutInput.svelte';
  import SingleEquipPicker from './lib/SingleEquipPicker.svelte';
  import SkillCatalog from './lib/SkillCatalog.svelte';
  import ArmorCatalog from './lib/ArmorCatalog.svelte';
  import TalismanCatalog from './lib/TalismanCatalog.svelte';
  import AdventureWorkspace from './lib/AdventureWorkspace.svelte';
  import CharacterSheet from './lib/CharacterSheet.svelte';
  import { applyCostShortcut, type CostShortcut } from './lib/skillForm';
  import { weaponCategorySizes, withWeaponCategorySize } from './lib/weaponCategoryForm';
  import { combinedCategoryOptions, combinedCategorySelection, splitCategorySelection } from './lib/skillCategorySelection';
  import { deleteJson, getJson, sendJson } from './lib/api';
  import { adminKindForPath, type AdminKind } from './lib/router';
  import { abilityKeys, type AbilityKey, type AbilityValues, type Adventure, type AdventureDetail, type AdminOptions, type ArmorSetSummary, type CharacterDetail, type CharacterInput, type CharacterSummary, type EpisodeStatus, type Origin, type OriginSkill } from './lib/types';

  const abilityLabels: Record<AbilityKey,string>={vigor:'生命力',mind:'精神力',endurance:'持久力',strength:'筋力',dexterity:'技量',intelligence:'知力',faith:'信仰',arcane:'神秘'};
  const dieFaces=['⚀️','⚁️','⚂️','⚃️','⚄️','⚅️'];
  const emptyAbilities=(value=0):AbilityValues=>Object.fromEntries(abilityKeys.map(k=>[k,value])) as AbilityValues;
  const emptyCharacter=():CharacterInput=>({name:'',adventureId:0,originId:0,level:1,runes:0,materialPoints:0,growth:emptyAbilities(),bonus:emptyAbilities(),resources:{maxHpModifier:0,maxFpModifier:0,maxBlessingModifier:0,flaskTotalModifier:0,crimsonFlaskHealModifier:0,crimsonFlaskAllocation:0,ceruleanFlaskHealModifier:0,ceruleanFlaskAllocation:0}});
  const adminLabels:Record<AdminKind,string>={episodes:'エピソード','special-items':'特別なアイテム',origins:'素性',armors:'防具','armor-sets':'防具セット',weapons:'武器','weapon-categories':'武器カテゴリ',shields:'盾','shield-categories':'盾カテゴリ',talismans:'タリスマン',skills:'スキル','skill-sets':'スキルセット','spirit-ashes':'遺灰'};
  const adminSections=[
    {title:'冒険',items:[['エピソードを追加','/admin/episodes/new','メイン・外伝エピソードを登録'],['特別なアイテムを追加','/admin/special-items/new','冒険で共有するアイテム種別を登録']]},
    {title:'素性',items:[['素性を追加','/admin/origins/new','初期能力値と初期装備を登録']]},
    {title:'防具',items:[['防具を追加','/admin/armors/new','頭・胴体防具を登録'],['防具一覧','/admin/armors','検索・詳細・編集・削除'],['防具セットを追加','/admin/armor-sets/new','シリーズ効果を登録'],['防具セット一覧','/admin/armor-sets','登録内容の確認・削除']]},
    {title:'装備（武器・盾・タリスマン）',items:[['武器を追加','/admin/weapons/new','武器データを登録'],['武器カテゴリを追加','/admin/weapon-categories/new','武器種別と攻撃性能を登録'],['盾を追加','/admin/shields/new','盾データを登録'],['盾カテゴリを追加','/admin/shield-categories/new','盾種別を登録'],['タリスマンを追加','/admin/talismans/new','名前と効果を登録'],['タリスマン一覧','/admin/talismans','検索・詳細・編集・削除']]},
    {title:'スキル関連',items:[['スキルを追加','/admin/skills/new','スキルデータを登録'],['スキル一覧','/admin/skills','検索・詳細・編集・削除'],['スキルセットを追加','/admin/skill-sets/new','スキルの組み合わせを登録']]},
    {title:'遺灰',items:[['遺灰を追加','/admin/spirit-ashes/new','遺灰データを登録']]}
  ];

  let path=window.location.pathname;
  let busy=false,errorMessage='',successMessage='';
  let adventures:Adventure[]=[],origins:Origin[]=[],characters:CharacterSummary[]=[],armorSets:ArmorSetSummary[]=[],character:CharacterDetail|null=null,adventure:AdventureDetail|null=null,options:AdminOptions|null=null;
  let characterForm=emptyCharacter();
  let viewedSkill:OriginSkill|null=null;
  let adventureForm={name:'',memo:''};
  const initialAdminKind=adminKindForPath(window.location.pathname);
  let adminForm:Record<string,unknown>=initialAdminKind?initialAdmin(initialAdminKind):{};
  let showRelated=false;

  $: characterId=Number(path.match(/^\/characters\/(\d+)/)?.[1]??0);
  $: adventureId=Number(path.match(/^\/adventures\/(\d+)/)?.[1]??0);
  $: adventureEditing=/^\/adventures\/\d+\/edit$/.test(path);
  $: selectedOrigin=origins.find(origin=>origin.id===Number(characterForm.originId));
  let adminKind:AdminKind|'';
  $: adminKind=adminKindForPath(path)??'';

  function prepareRoute(to:string){const kind=adminKindForPath(to);if(kind){adminForm=initialAdmin(kind);showRelated=false;}}
  function go(to:string){prepareRoute(to);history.pushState({},'',to);path=to;errorMessage='';successMessage='';void load();}
  function message(error:unknown){errorMessage=error instanceof Error?error.message:'予期しないエラーが発生しました。';}
  function selectedIds(event:Event){return Array.from((event.currentTarget as HTMLSelectElement).selectedOptions).map(o=>Number(o.value));}
  function setSkillField(field:'classification'|'target',value:string){adminForm[field]=value;adminForm={...adminForm};}
  function addSkillCost(shortcut:CostShortcut){adminForm.cost=applyCostShortcut(String(adminForm.cost??''),shortcut);adminForm={...adminForm};}
  function prependRequiredAbility(){const effects=adminForm.rankEffects as string[];if(!effects[0].startsWith('〔必要能力値：〕'))effects[0]=`〔必要能力値：〕${effects[0]}`;adminForm={...adminForm,rankEffects:[...effects]};}
  function setWeaponCategorySize(size:string){adminForm.size=size;adminForm.name=withWeaponCategorySize(String(adminForm.name??''),size);adminForm={...adminForm};}
  function normalizeWeaponCategoryName(){if(adminKind!=='weapon-categories')return;adminForm.name=withWeaponCategorySize(String(adminForm.name??''),String(adminForm.size??''));adminForm={...adminForm};}
  function setSkillCategorySelection(ids:Array<string|number>){const selected=splitCategorySelection(ids);adminForm.categoryIds=selected.weaponCategoryIds;adminForm.shieldCategoryIds=selected.shieldCategoryIds;adminForm={...adminForm};}
  async function copyDieFace(face:string){try{await navigator.clipboard.writeText(face);successMessage=`${face} をクリップボードにコピーしました。`;errorMessage='';}catch{errorMessage='クリップボードにコピーできませんでした。';successMessage='';}}
  function initialAdmin(kind:AdminKind):Record<string,unknown>{
    const req=()=>({strength:0,dexterity:0,intelligence:0,faith:0,arcane:0});
    if(kind==='origins')return{name:'',initialLevel:10,initial:emptyAbilities(10),skillSetIds:[],weaponIds:[],shieldIds:[],headArmorId:null,bodyArmorId:null};
    if(kind==='episodes')return{name:'',episodeType:'MAIN',episodeNumber:0,maliceLevel:0};
    if(kind==='special-items')return{name:''};
    if(kind==='talismans')return{name:'',weight:0,effect:''};
    if(kind==='armors')return{name:'',slot:'HEAD',armorSetId:'',weight:0,physicalCut:0,phenomenonCut:0,poise:0,skillIds:[]};
    if(kind==='armor-sets')return{name:'',seriesEffect:'',skillIds:[]};
    if(kind==='weapons')return{name:'',categoryId:'',weight:0,powerModifier:'',requirements:req(),skillIds:[]};
    if(kind==='weapon-categories')return{name:'',size:'',attackCost:0,oneHandDamage:['','','','',''],twoHandDamage:['','','','',''],guardCost:0,twoHandPhysicalGuard:'',twoHandPhenomenonGuard:'',skillIds:[]};
    if(kind==='shields')return{name:'',categoryId:'',weight:0,guardCost:0,physicalGuard:'',phenomenonGuard:'',requirements:req(),skillIds:[]};
    if(kind==='shield-categories')return{name:'',size:''};
    if(kind==='skills')return{name:'',classification:'',timing:'AC',target:'',cost:'',maxUses:null,rankEffects:['','',''],categoryIds:[],shieldCategoryIds:[]};
    if(kind==='skill-sets')return{name:'',notes:'',skillIds:[]};
    return{name:'',partySlotCost:0,summonCost:'',summonCount:1,level:0,movementModifier:0,perceptionModifier:0,physicalCut:0,phenomenonCut:0,guardCount:0,guardCutRate:0,evasionCount:0,specialAbility:'',mainAction:{name:'',target:'',damage:''},subAction:{name:'',target:'',damage:''},actionSpecialEffect:'',upgradeEffects:['','','','','']};
  }
  function newRelated(kind:AdminKind){
    if(kind==='armors')return{name:'',seriesEffect:''};
    return{name:'',size:'',attackCost:0,oneHandDamage:['','','','',''],twoHandDamage:['','','','',''],guardCost:0,twoHandPhysicalGuard:'',twoHandPhenomenonGuard:''};
  }

  async function load(){
    busy=true;errorMessage='';character=null;adventure=null;
    try{
      [adventures,origins]=await Promise.all([getJson<Adventure[]>('/api/adventures'),getJson<Origin[]>('/api/origins')]);
      if(path==='/' ){history.replaceState({},'','/characters');path='/characters';}
      if(path==='/characters')characters=await getJson<CharacterSummary[]>('/api/characters');
      else if(characterId){
        if(path.endsWith('/edit')){history.replaceState({},'',`/characters/${characterId}`);path=`/characters/${characterId}`;}
        character=await getJson<CharacterDetail>(`/api/characters/${characterId}`);
      }
      else if(path==='/characters/new')characterForm={...emptyCharacter(),adventureId:adventures[0]?.id??0,originId:origins[0]?.id??0,level:origins[0]?.initialLevel??0};
      else if(adventureId&&adventureEditing){history.replaceState({},'',`/adventures/${adventureId}`);path=`/adventures/${adventureId}`;adventure=await getJson<AdventureDetail>(`/api/adventures/${adventureId}`);}
      else if(adventureId)adventure=await getJson<AdventureDetail>(`/api/adventures/${adventureId}`);
      else if(path==='/adventures/new')adventureForm={name:'',memo:''};
      if(path.startsWith('/admin'))options=await getJson<AdminOptions>('/api/admin/options');
      if(path==='/admin/armor-sets')armorSets=await getJson<ArmorSetSummary[]>('/api/admin/armor-sets');
    }catch(error){message(error);}finally{busy=false;}
  }
  async function saveCharacter(){
    busy=true;errorMessage='';successMessage='';
    try{
      const payload={...characterForm,level:selectedOrigin?.initialLevel??0,runes:0,materialPoints:0,growth:emptyAbilities(),bonus:emptyAbilities()};
      const saved=await sendJson<CharacterDetail>('/api/characters','POST',payload);
      go(`/characters/${saved.id}`);
    }catch(error){message(error);}finally{busy=false;}
  }
  async function saveAdventure(){busy=true;errorMessage='';try{await sendJson(adventureId?`/api/adventures/${adventureId}`:'/api/adventures',adventureId?'PUT':'POST',adventureForm);go('/adventures');}catch(error){message(error);}finally{busy=false;}}
  async function setEpisodeStatus(episodeId:number,status:EpisodeStatus){if(!adventure)return;errorMessage='';try{await sendJson(`/api/adventures/${adventure.id}/episodes/${episodeId}`,'PUT',{status});adventure={...adventure,episodes:adventure.episodes.map(episode=>episode.id===episodeId?{...episode,status}:episode)};}catch(error){message(error);}}
  async function saveAdmin(){if(!adminKind)return;busy=true;errorMessage='';try{await sendJson(`/api/admin/${adminKind}`,'POST',adminForm);successMessage=`${adminLabels[adminKind]}を登録しました。`;adminForm=initialAdmin(adminKind);showRelated=false;options=await getJson<AdminOptions>('/api/admin/options');}catch(error){message(error);}finally{busy=false;}}
  async function removeArmorSet(armorSet:ArmorSetSummary){
    if(!window.confirm(`防具セット「${armorSet.name}」を削除しますか？\nこのセットを使っている防具は、セット未指定になります。`))return;
    busy=true;errorMessage='';successMessage='';
    try{
      await deleteJson<{ok:boolean}>(`/api/admin/armor-sets/${armorSet.id}`);
      armorSets=armorSets.filter(item=>item.id!==armorSet.id);
      options=await getJson<AdminOptions>('/api/admin/options');
      successMessage=`防具セット「${armorSet.name}」を削除しました。`;
    }catch(error){message(error);}finally{busy=false;}
  }
  function addRelated(){if(!adminKind)return;const keys:Partial<Record<AdminKind,string>>={armors:'newArmorSet'};const key=keys[adminKind];if(key)adminForm[key]=newRelated(adminKind);showRelated=true;adminForm={...adminForm};}
  function relationOptions(){if(!options||!adminKind)return[];if(adminKind==='origins')return options.skillSets;if(adminKind==='armors')return options.armorSets;if(adminKind==='shields')return options.shieldCategories;return options.weaponCategories;}
  onMount(()=>{const pop=()=>{prepareRoute(window.location.pathname);path=window.location.pathname;void load();};window.addEventListener('popstate',pop);void load();return()=>window.removeEventListener('popstate',pop);});
</script>

<svelte:head><title>褪せ人の記録庫 | ELDEN RING TRPG</title></svelte:head>
<header class="site-header"><button class="brand-mark" aria-label="キャラクター一覧" onclick={()=>go('/characters')}>ER</button><div><p class="eyebrow">ELDEN RING TRPG</p><h1>褪せ人の記録庫</h1></div><nav><button class:active={path.startsWith('/characters')} onclick={()=>go('/characters')}>キャラクター</button><button class:active={path.startsWith('/adventures')} onclick={()=>go('/adventures')}>冒険</button><button class:active={path.startsWith('/admin')} onclick={()=>go('/admin/')}>管理</button></nav></header>

<main class="app-shell" aria-busy={busy}>
  {#if errorMessage}<div class="notice notice--error" role="alert">{errorMessage}</div>{/if}
  {#if successMessage}<div class="notice notice--success" role="status">{successMessage}</div>{/if}
  {#if busy && !errorMessage}<div class="loading">記録を読み込んでいます…</div>{/if}

  {#if path==='/characters'}
    <div class="toolbar"><div><p class="eyebrow">CHARACTER ARCHIVE</p><h2>キャラクター一覧</h2></div><button class="button button--primary" onclick={()=>go('/characters/new')} disabled={!adventures.length||!origins.length}>新しい記録</button></div>
    {#if !characters.length&&!busy}<section class="empty-state card"><h3>記録はまだありません</h3><p>管理画面で素性を登録し、冒険を作成してから、最初のキャラクターを作成してください。</p><div class="button-row"><button class="button button--quiet" onclick={()=>go('/admin/origins/new')}>素性を登録</button><button class="button button--quiet" onclick={()=>go('/adventures/new')}>冒険を作成</button></div></section>{/if}
    <div class="card-grid">{#each characters as c}<button class="record-card" onclick={()=>go(`/characters/${c.id}`)}><span class="eyebrow">LV. {c.level}</span><strong>{c.name}</strong><span>{c.originName} · {c.adventureName}</span></button>{/each}</div>
  {:else if path==='/characters/new'}
    <form class="card form" onsubmit={(e)=>{e.preventDefault();void saveCharacter();}}><div class="panel-heading"><div><p class="eyebrow">CHARACTER RECORD</p><h2>キャラクター作成</h2></div></div>
      <div class="form-grid"><label class="field field--wide"><span>名前</span><input bind:value={characterForm.name} required maxlength="80"></label><label class="field"><span>冒険</span><select bind:value={characterForm.adventureId} required>{#each adventures as a}<option value={a.id}>{a.name}</option>{/each}</select></label><label class="field"><span>素性</span><select bind:value={characterForm.originId} required>{#each origins as o}<option value={o.id}>{o.name}</option>{/each}</select></label></div>
      {#if selectedOrigin}<section class="origin-preview" aria-label="素性の初期情報"><div class="origin-preview__heading"><div><p class="eyebrow">ORIGIN PROFILE</p><h3>{selectedOrigin.name}</h3></div><div class="origin-level"><span>初期レベル</span><strong>{selectedOrigin.initialLevel}</strong></div></div><div class="origin-stats">{#each abilityKeys as key}<div><span>{abilityLabels[key]}</span><strong>{selectedOrigin.initial[key]}</strong></div>{/each}</div><div class="origin-loadout"><section><h4>初期武器</h4><p>{selectedOrigin.weapons.map(item=>item.name).join('、')||'なし'}</p></section><section><h4>初期盾</h4><p>{selectedOrigin.shields.map(item=>item.name).join('、')||'なし'}</p></section><section><h4>初期防具</h4><dl><div><dt>頭</dt><dd>{selectedOrigin.armors.head?.name??'なし'}</dd></div><div><dt>胴体</dt><dd>{selectedOrigin.armors.body?.name??'なし'}</dd></div></dl></section></div><div class="origin-skill-sets"><h4>初期スキルセット</h4>{#if selectedOrigin.skillSets.length}{#each selectedOrigin.skillSets as skillSet}<section class="origin-skill-set"><div><strong>{skillSet.name}</strong>{#if skillSet.notes}<p>{skillSet.notes}</p>{/if}</div><div class="origin-skill-links">{#each skillSet.skills as skill}<button type="button" onclick={()=>viewedSkill=skill}>{skill.name}</button>{/each}</div></section>{/each}{:else}<p class="muted">なし</p>{/if}</div><p class="origin-initial-note">作成時はルーン・素材点・能力値の成長値・追加値がすべて0になります。</p></section>{/if}
      <div class="form-actions"><button type="button" class="button button--quiet" onclick={()=>history.back()}>キャンセル</button><button class="button button--primary" disabled={busy}>保存する</button></div>
    </form>
  {:else if character}
    <CharacterSheet {character} onUpdated={(updated)=>character=updated}/>
  {:else if path==='/adventures'}
    <div class="toolbar"><div><p class="eyebrow">ADVENTURES</p><h2>冒険一覧</h2></div><button class="button button--primary" onclick={()=>go('/adventures/new')}>新しい冒険</button></div><div class="card-grid">{#each adventures as a}<button class="record-card" onclick={()=>go(`/adventures/${a.id}`)}><strong>{a.name}</strong><span>{a.characterCount} 人のキャラクター</span><small>{a.memo||'メモなし'}</small></button>{/each}</div>{#if !adventures.length&&!busy}<div class="empty-state card">冒険はまだありません。</div>{/if}
  {:else if adventure}
    <AdventureWorkspace {adventure} onNavigate={go} onEpisodeStatus={(episodeId,status)=>void setEpisodeStatus(episodeId,status)} />
  {:else if path==='/adventures/new'}
    <form class="card form narrow" onsubmit={(e)=>{e.preventDefault();void saveAdventure();}}><p class="eyebrow">ADVENTURE</p><h2>{adventureId?'冒険を編集':'冒険を作成'}</h2><label class="field"><span>名前</span><input bind:value={adventureForm.name} required></label><label class="field"><span>メモ</span><textarea bind:value={adventureForm.memo} rows="8"></textarea></label><div class="form-actions"><button type="button" class="button button--quiet" onclick={()=>go('/adventures')}>キャンセル</button><button class="button button--primary">保存する</button></div></form>
  {:else if path==='/admin/'||path==='/admin'}
    <div class="toolbar"><div><p class="eyebrow">MASTER DATA</p><h2>管理メニュー</h2></div></div><div class="admin-sections">{#each adminSections as section}<section class="admin-section"><h3>{section.title}</h3><div class="admin-grid">{#each section.items as item}<button class="record-card" onclick={()=>go(item[1])}><strong>{item[0]}</strong><span>{item[2]}</span></button>{/each}</div></section>{/each}</div>
  {:else if path==='/admin/armor-sets'}
    <div class="toolbar"><div><p class="eyebrow">MASTER DATA</p><h2>防具セット一覧</h2><p class="muted">{armorSets.length} 件の防具セット</p></div><div class="toolbar-actions"><button class="button button--quiet" onclick={()=>go('/admin/')}>管理メニュー</button><button class="button button--primary" onclick={()=>go('/admin/armor-sets/new')}>新規追加</button></div></div>
    {#if armorSets.length}<div class="armor-set-list">{#each armorSets as armorSet}<article class="card armor-set-item"><div><p class="eyebrow">ARMOR SET #{armorSet.id}</p><h3>{armorSet.name}</h3><p class="armor-set-item__effect">{armorSet.seriesEffect||'シリーズ効果なし'}</p><p class="armor-set-item__meta">所属防具 {armorSet.armorCount} 件 · 装備スキル {armorSet.skillCount} 件</p></div><button class="button button--danger" onclick={()=>void removeArmorSet(armorSet)} disabled={busy}>削除</button></article>{/each}</div>{:else if !busy}<section class="empty-state card"><h3>防具セットはまだありません</h3><p>「新規追加」から最初の防具セットを登録できます。</p></section>{/if}
  {:else if path==='/admin/skills'}
    <SkillCatalog {options} onNavigate={go} onChanged={()=>void load()} />
  {:else if path==='/admin/armors'}
    <ArmorCatalog {options} onNavigate={go} onChanged={()=>void load()} />
  {:else if path==='/admin/talismans'}
    <TalismanCatalog onNavigate={go} onChanged={()=>void load()} />
  {:else if adminKind}
    <form class="card form" onsubmit={(e)=>{e.preventDefault();void saveAdmin();}}><div class="panel-heading"><div><p class="eyebrow">MASTER DATA</p><h2>{adminLabels[adminKind]}を追加</h2></div><button type="button" class="button button--quiet" onclick={()=>go('/admin/')}>管理メニュー</button></div>
      <div class="form-grid"><label class="field field--wide" class:field--full={adminKind==='skills'}><span>名前</span><input bind:value={adminForm.name} onblur={normalizeWeaponCategoryName} required></label>
      {#if adminKind==='special-items'}<p class="muted field--full">冒険ごとに所持数を管理するアイテム種別を登録します。</p>
      {:else if adminKind==='talismans'}<label class="field"><span>重量</span><input type="number" bind:value={adminForm.weight} required></label><label class="field field--full"><span>効果</span><textarea rows="8" bind:value={adminForm.effect} required></textarea></label>
      {:else if adminKind==='episodes'}<label class="field"><span>種別</span><select bind:value={adminForm.episodeType}><option value="MAIN">メイン</option><option value="SIDE">外伝</option></select></label><label class="field"><span>EP番号</span><input type="number" min={adminForm.episodeType==='MAIN'?0:1} max={adminForm.episodeType==='MAIN'?11:10} bind:value={adminForm.episodeNumber}></label><label class="field"><span>悪意適正レベル</span><input type="number" min="0" bind:value={adminForm.maliceLevel}></label>
      {:else if adminKind==='origins'}<label class="field"><span>初期レベル</span><input type="number" min="0" bind:value={adminForm.initialLevel}></label>
      {:else if adminKind==='armors'}<label class="field"><span>部位</span><select bind:value={adminForm.slot}><option value="HEAD">頭</option><option value="BODY">胴体</option></select></label><label class="field"><span>重量</span><input type="number" min="0" bind:value={adminForm.weight}></label><label class="field"><span>物理カット</span><input type="number" bind:value={adminForm.physicalCut}></label><label class="field"><span>現象カット</span><input type="number" bind:value={adminForm.phenomenonCut}></label><label class="field"><span>強靭値</span><input type="number" bind:value={adminForm.poise}></label>
      {:else if adminKind==='armor-sets'}<label class="field field--full"><span>シリーズ効果</span><textarea rows="5" bind:value={adminForm.seriesEffect}></textarea></label>
      {:else if adminKind==='weapons'}<label class="field"><span>重量</span><input type="number" min="0" bind:value={adminForm.weight}></label><label class="field"><span>威力補正</span><input bind:value={adminForm.powerModifier} required></label>
      {:else if adminKind==='weapon-categories'}<label class="field"><span>サイズ</span><select value={adminForm.size} onchange={(event)=>setWeaponCategorySize((event.currentTarget as HTMLSelectElement).value)} required><option value="" disabled>選択</option>{#each weaponCategorySizes as size}<option value={size}>{size}</option>{/each}</select></label>
      {:else if adminKind==='shields'}<label class="field"><span>重量</span><input type="number" min="0" bind:value={adminForm.weight}></label><label class="field"><span>ガードコスト</span><input type="number" min="0" bind:value={adminForm.guardCost}></label><GuardCutInput label="物理カット" value={String(adminForm.physicalGuard??'')} required onChange={(value)=>{adminForm.physicalGuard=value;adminForm={...adminForm};}} /><GuardCutInput label="現象カット" value={String(adminForm.phenomenonGuard??'')} required onChange={(value)=>{adminForm.phenomenonGuard=value;adminForm={...adminForm};}} />
      {:else if adminKind==='shield-categories'}<label class="field"><span>サイズ</span><input bind:value={adminForm.size} required></label>
      {:else if adminKind==='skills'}
        <div class="skill-meta-row field--full"><label class="field"><span>タイミング</span><select bind:value={adminForm.timing}><option value="AC">Ac</option><option value="RE">Re</option><option value="TRIGGER">Trigger</option><option value="PASSIVE">Passive</option></select></label><label class="field"><span>最大使用回数（空欄は無制限）</span><input type="number" min="0" bind:value={adminForm.maxUses}></label></div>
        <div class="field field--wide"><label><span>分類</span><input bind:value={adminForm.classification} required></label><div class="shortcut-row" aria-label="分類の候補">{#each ['戦技','魔術（）','祈祷（）','心得'] as value}<button type="button" class="shortcut-button" onclick={()=>setSkillField('classification',value)}>{value}</button>{/each}</div></div>
        <div class="field field--wide"><label><span>対象</span><input bind:value={adminForm.target} required></label><div class="shortcut-row" aria-label="対象の候補">{#each ['使用者','エネミー１体','エネミー全員','PC１体','仲間全員'] as value}<button type="button" class="shortcut-button" onclick={()=>setSkillField('target',value)}>{value}</button>{/each}</div></div>
        <div class="field field--wide"><label><span>コスト</span><input bind:value={adminForm.cost} required></label><div class="shortcut-row" aria-label="コストの入力補助"><button type="button" class="shortcut-button" onclick={()=>addSkillCost('dice')}>ダイス１個</button><button type="button" class="shortcut-button" onclick={()=>addSkillCost('sequence')}>連番２個</button><button type="button" class="shortcut-button" onclick={()=>addSkillCost('pair')}>ゾロ２個</button><button type="button" class="shortcut-button" onclick={()=>addSkillCost('fp')}>FP■</button></div></div>
      {:else if adminKind==='skill-sets'}<label class="field field--full"><span>注意点</span><textarea rows="5" bind:value={adminForm.notes}></textarea></label>
      {:else}<label class="field"><span>人数枠</span><input type="number" min="0" bind:value={adminForm.partySlotCost}></label><label class="field"><span>召喚コスト</span><input bind:value={adminForm.summonCost} required></label><label class="field"><span>召喚数</span><input type="number" min="0" bind:value={adminForm.summonCount}></label><label class="field"><span>レベル</span><input type="number" min="0" bind:value={adminForm.level}></label>{/if}</div>

      {#if ['weapons','shields'].includes(adminKind)}<h3>必要能力値</h3><div class="mini-grid">{#each ['strength','dexterity','intelligence','faith','arcane'] as key}<label class="field"><span>{abilityLabels[key as AbilityKey]}</span><input type="number" min="0" bind:value={(adminForm.requirements as Record<string,number>)[key]}></label>{/each}</div>{/if}
      {#if adminKind==='origins'}<h3>初期能力値</h3><div class="mini-grid">{#each abilityKeys as key}<label class="field"><span>{abilityLabels[key]}</span><input type="number" min="0" bind:value={(adminForm.initial as AbilityValues)[key]}></label>{/each}</div>{/if}
      {#if adminKind==='origins'}<h3>初期スキルセット</h3><SkillTransfer itemLabel="スキルセット" skills={options?.skillSets??[]} selectedIds={adminForm.skillSetIds as number[]} onChange={(value)=>{adminForm.skillSetIds=value.map(Number);adminForm={...adminForm};}} /><h3>初期武器</h3><p class="muted">同じ武器を複数回追加できます。</p><SkillTransfer itemLabel="武器" skills={options?.weapons??[]} selectedIds={adminForm.weaponIds as number[]} allowDuplicates={true} onChange={(value)=>{adminForm.weaponIds=value.map(Number);adminForm={...adminForm};}} /><h3>初期盾</h3><SkillTransfer itemLabel="盾" skills={options?.shields??[]} selectedIds={adminForm.shieldIds as number[]} onChange={(value)=>{adminForm.shieldIds=value.map(Number);adminForm={...adminForm};}} /><h3>初期防具</h3><div class="origin-armor-grid"><div><h4>頭</h4><SingleEquipPicker itemLabel="頭防具" items={(options?.armors??[]).filter((armor)=>armor.slot==='HEAD')} selectedId={adminForm.headArmorId as number|null} onChange={(value)=>{adminForm.headArmorId=value;adminForm={...adminForm};}} /></div><div><h4>胴体</h4><SingleEquipPicker itemLabel="胴体防具" items={(options?.armors??[]).filter((armor)=>armor.slot==='BODY')} selectedId={adminForm.bodyArmorId as number|null} onChange={(value)=>{adminForm.bodyArmorId=value;adminForm={...adminForm};}} /></div></div>{/if}
      {#if adminKind==='skills'}<h3>ランク効果</h3><div class="mini-grid">{#each [0,1,2] as rank}<label class="field"><span>ランク {rank+1}</span><textarea rows="3" bind:value={(adminForm.rankEffects as string[])[rank]}></textarea>{#if rank===0}<button type="button" class="shortcut-button field-shortcut" onclick={prependRequiredAbility}>先頭に「〔必要能力値：〕」を追加</button>{/if}</label>{/each}</div><section class="dice-copy"><div><h3>サイコロ絵文字</h3><p class="muted">クリックするとクリップボードにコピーします。</p></div><div class="dice-copy__buttons">{#each dieFaces as face}<button type="button" class="dice-copy__button" aria-label={`${face}をコピー`} title={`${face}をコピー`} onclick={()=>void copyDieFace(face)}>{face}</button>{/each}</div></section><h3>対応する武器・盾カテゴリ</h3><SkillTransfer itemLabel="武器・盾カテゴリ" skills={combinedCategoryOptions(options?.weaponCategories??[],options?.shieldCategories??[])} selectedIds={combinedCategorySelection(adminForm.categoryIds as number[],adminForm.shieldCategoryIds as number[])} onChange={setSkillCategorySelection} />{/if}
      {#if adminKind==='skill-sets'}<h3>セットに含めるスキル</h3><SkillTransfer skills={options?.skills??[]} selectedIds={adminForm.skillIds as number[]} onChange={(value)=>{adminForm.skillIds=value;adminForm={...adminForm};}} />{/if}
      {#if adminKind==='armor-sets'}<h3>装備スキル</h3><SkillTransfer skills={options?.skills??[]} selectedIds={adminForm.skillIds as number[]} onChange={(value)=>{adminForm.skillIds=value;adminForm={...adminForm};}} />{/if}
      {#if adminKind==='weapon-categories'}<div class="guard-row"><label class="field"><span>ガードコスト</span><input type="number" min="0" bind:value={adminForm.guardCost}></label><GuardCutInput label="物理カット（ガード不可なら空欄）" value={String(adminForm.twoHandPhysicalGuard??'')} onChange={(value)=>{adminForm.twoHandPhysicalGuard=value;adminForm={...adminForm};}} /><GuardCutInput label="現象カット（ガード不可なら空欄）" value={String(adminForm.twoHandPhenomenonGuard??'')} onChange={(value)=>{adminForm.twoHandPhenomenonGuard=value;adminForm={...adminForm};}} /></div><label class="field attack-cost"><span>アタックコスト</span><input type="number" min="0" bind:value={adminForm.attackCost}></label><h3>ダメージ</h3><p class="muted">攻撃できない持ち方・hit数は空欄にします。</p><div class="damage-table" role="group" aria-label="片手・両手ダメージ"><div class="damage-table__header"><span></span>{#each [1,2,3,4,5] as hit}<strong>{hit} hit</strong>{/each}</div>{#each [['oneHandDamage','片手'],['twoHandDamage','両手']] as row}<div class="damage-table__row"><strong>{row[1]}</strong>{#each [0,1,2,3,4] as hit}<input aria-label={`${row[1]}${hit+1} hit`} bind:value={(adminForm[row[0]] as string[])[hit]}>{/each}</div>{/each}</div><h3>装備スキル</h3><SkillTransfer skills={options?.skills??[]} selectedIds={adminForm.skillIds as number[]} onChange={(value)=>{adminForm.skillIds=value;adminForm={...adminForm};}} />{/if}
      {#if adminKind==='spirit-ashes'}<h3>性能</h3><div class="mini-grid">{#each [['movementModifier','運動補正'],['perceptionModifier','感知補正'],['physicalCut','物理カット'],['phenomenonCut','現象カット'],['guardCount','ガード回数'],['guardCutRate','ガード時カット率'],['evasionCount','回避回数']] as item}<label class="field"><span>{item[1]}</span><input type="number" min={['guardCount','guardCutRate','evasionCount'].includes(item[0])?0:undefined} bind:value={adminForm[item[0]]}></label>{/each}</div><label class="field"><span>特殊能力</span><textarea bind:value={adminForm.specialAbility}></textarea></label><div class="mini-grid">{#each [['mainAction','メイン'],['subAction','サブ']] as action}<fieldset><legend>{action[1]}アクション</legend>{#each [['name','名前'],['target','対象'],['damage','ダメージ']] as field}<label class="field"><span>{field[1]}</span><input bind:value={(adminForm[action[0]] as Record<string,string>)[field[0]]} required></label>{/each}</fieldset>{/each}</div><label class="field"><span>アクション特殊効果</span><textarea bind:value={adminForm.actionSpecialEffect}></textarea></label><h3>強化時効果</h3><div class="mini-grid">{#each [0,1,2,3,4] as level}<label class="field"><span>+{level+1}</span><textarea bind:value={(adminForm.upgradeEffects as string[])[level]}></textarea></label>{/each}</div>{/if}

      {#if adminKind==='weapons'}<div class="form-grid"><label class="field"><span>武器カテゴリ</span><select bind:value={adminForm.categoryId} required><option value="" disabled>選択</option>{#each options?.weaponCategories??[] as o}<option value={o.id}>{o.name}</option>{/each}</select></label></div><h3>装備スキル</h3><SkillTransfer skills={options?.skills??[]} selectedIds={adminForm.skillIds as number[]} onChange={(value)=>{adminForm.skillIds=value;adminForm={...adminForm};}} />{/if}
      {#if adminKind==='shields'}<div class="form-grid"><label class="field"><span>盾カテゴリ</span><select bind:value={adminForm.categoryId} required><option value="" disabled>選択</option>{#each options?.shieldCategories??[] as o}<option value={o.id}>{o.name}</option>{/each}</select></label></div><h3>装備スキル</h3><SkillTransfer skills={options?.skills??[]} selectedIds={adminForm.skillIds as number[]} onChange={(value)=>{adminForm.skillIds=value;adminForm={...adminForm};}} />{/if}

      {#if !['episodes','special-items','talismans','origins','armor-sets','spirit-ashes','weapon-categories','shield-categories','weapons','shields','skills','skill-sets'].includes(adminKind)}<section class="relation-box"><p class="muted">登録済みの項目を選択します。</p>
        {#if adminKind==='origins'}<label class="field"><span>初期スキルセット</span><select multiple onchange={(e)=>adminForm.skillSetIds=selectedIds(e)}>{#each options?.skillSets??[] as o}<option value={o.id}>{o.name}</option>{/each}</select></label><label class="field"><span>初期武器</span><select multiple onchange={(e)=>adminForm.weaponIds=selectedIds(e)}>{#each options?.weapons??[] as o}<option value={o.id}>{o.name}</option>{/each}</select></label><label class="field"><span>初期盾</span><select multiple onchange={(e)=>adminForm.shieldIds=selectedIds(e)}>{#each options?.shields??[] as o}<option value={o.id}>{o.name}</option>{/each}</select></label><label class="field"><span>初期防具</span><select multiple onchange={(e)=>adminForm.armorIds=selectedIds(e)}>{#each options?.armors??[] as o}<option value={o.id}>{o.name}（{o.slot==='HEAD'?'頭':'胴'}）</option>{/each}</select></label>
        {:else}<label class="field"><span>{adminKind==='armors'?'防具セット':'武器カテゴリ'}</span>{#if adminKind==='armors'}<select bind:value={adminForm.armorSetId}><option value="">未指定</option>{#each relationOptions() as o}<option value={o.id}>{o.name}</option>{/each}</select>{:else}<select multiple onchange={(e)=>adminForm.categoryIds=selectedIds(e)}>{#each relationOptions() as o}<option value={o.id}>{o.name}</option>{/each}</select>{/if}</label>{#if adminKind==='armors'}<h3>装備スキル</h3><SkillTransfer skills={options?.skills??[]} selectedIds={adminForm.skillIds as number[]} onChange={(value)=>{adminForm.skillIds=value;adminForm={...adminForm};}} />{/if}{/if}
        {#if adminKind!=='origins'||true}<button type="button" class="text-button" onclick={addRelated}>該当する関連マスターがない場合は新規追加</button>{/if}
        {#if showRelated}<div class="subform"><h3>関連マスターを同時追加</h3><label class="field"><span>名前</span><input bind:value={(adminForm[adminKind==='origins'?'newSkillSet':adminKind==='armors'?'newArmorSet':'newCategory'] as Record<string,unknown>).name} required></label>
          {#if adminKind==='origins'}<label class="field"><span>注意点</span><textarea bind:value={(adminForm.newSkillSet as Record<string,unknown>).notes}></textarea></label><label class="field"><span>セットに含めるスキル</span><select multiple onchange={(e)=>(adminForm.newSkillSet as Record<string,unknown>).skillIds=selectedIds(e)}>{#each options?.skills??[] as o}<option value={o.id}>{o.name}</option>{/each}</select></label>{:else if adminKind==='armors'}<label class="field"><span>シリーズ効果</span><textarea bind:value={(adminForm.newArmorSet as Record<string,unknown>).seriesEffect}></textarea></label>{:else if adminKind==='shields'}<label class="field"><span>サイズ</span><input bind:value={(adminForm.newCategory as Record<string,unknown>).size} required></label>{:else}<label class="field"><span>サイズ</span><input bind:value={(adminForm.newCategory as Record<string,unknown>).size} required></label><div class="mini-grid"><label class="field"><span>アタックコスト</span><input type="number" min="0" bind:value={(adminForm.newCategory as Record<string,unknown>).attackCost}></label><label class="field"><span>ガードコスト</span><input type="number" min="0" bind:value={(adminForm.newCategory as Record<string,unknown>).guardCost}></label>{#each [['twoHandPhysicalGuard','両手物理ガード'],['twoHandPhenomenonGuard','両手現象ガード']] as f}<label class="field"><span>{f[1]}</span><input bind:value={(adminForm.newCategory as Record<string,unknown>)[f[0]]} required></label>{/each}</div>{#each [['oneHandDamage','片手'],['twoHandDamage','両手']] as damage}<h4>{damage[1]}ダメージ</h4><div class="mini-grid">{#each [0,1,2,3,4] as hit}<label class="field"><span>{hit+1} hit</span><input bind:value={((adminForm.newCategory as Record<string,unknown>)[damage[0]] as string[])[hit]} required></label>{/each}</div>{/each}{/if}
        </div>{/if}</section>{/if}
      <div class="form-actions"><button class="button button--primary" disabled={busy}>登録する</button></div>
    </form>
  {:else if !busy}<section class="card empty-state"><h2>ページが見つかりません</h2><button class="text-button" onclick={()=>go('/characters')}>一覧へ戻る</button></section>{/if}

  {#if viewedSkill}<div class="modal-backdrop" role="presentation" onclick={(event)=>{if(event.target===event.currentTarget)viewedSkill=null;}}><div class="card skill-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-dialog-title"><div class="panel-heading"><div><p class="eyebrow">SKILL DETAIL</p><h2 id="skill-dialog-title">{viewedSkill.name}</h2></div><button type="button" class="button button--quiet" onclick={()=>viewedSkill=null}>閉じる</button></div><dl class="skill-dialog__meta"><div><dt>分類</dt><dd>{viewedSkill.classification}</dd></div><div><dt>タイミング</dt><dd>{viewedSkill.timing}</dd></div><div><dt>対象</dt><dd>{viewedSkill.target}</dd></div><div><dt>コスト</dt><dd>{viewedSkill.cost}</dd></div>{#if viewedSkill.maxUses!==null}<div><dt>最大使用回数</dt><dd>{viewedSkill.maxUses}</dd></div>{/if}</dl>{#each viewedSkill.rankEffects as effect,index}{#if effect}<section class="record-section"><h3>ランク {index+1}</h3><p>{effect}</p></section>{/if}{/each}</div></div>{/if}
</main>
<footer class="site-footer">Data stored in Cloudflare D1</footer>
