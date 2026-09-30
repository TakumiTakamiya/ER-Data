<script lang="ts">
  import SkillTransfer from './SkillTransfer.svelte';
  import { sendJson } from './api';
  import type { AdventureDetail, AdventureInventory, EpisodeStatus, SpecialItemQuantity } from './types';

  export let adventure: AdventureDetail;
  export let onNavigate: (path:string)=>void=()=>{};
  export let onEpisodeStatus: (episodeId:number,status:EpisodeStatus)=>void=()=>{};
  export let onSaved: ()=>void=()=>{};

  const inventoryLabels:Record<keyof AdventureInventory,string>={weapons:'武器',shields:'盾',armors:'防具',talismans:'タリスマン',skillSets:'スキルセット',spiritAshes:'遺灰'};
  const inventoryColumns:Array<Array<keyof AdventureInventory>>=[['weapons','shields','armors'],['talismans','skillSets','spiritAshes']];
  let memo=adventure.memo;
  let specialItems:SpecialItemQuantity[]=adventure.specialItems.map(item=>({...item}));
  let inventory:AdventureInventory={weapons:[...adventure.inventory.weapons],shields:[...adventure.inventory.shields],armors:[...adventure.inventory.armors],talismans:[...adventure.inventory.talismans],skillSets:[...adventure.inventory.skillSets],spiritAshes:[...adventure.inventory.spiritAshes]};
  let busy=false,errorMessage='',successMessage='';

  async function save(){busy=true;errorMessage='';successMessage='';try{await sendJson(`/api/adventures/${adventure.id}/contents`,'PUT',{memo,specialItems:specialItems.map(({id,quantity})=>({id,quantity})),inventory});successMessage='冒険の内容を保存しました。';onSaved();}catch(error){errorMessage=error instanceof Error?error.message:'保存できませんでした。';}finally{busy=false;}}
</script>

{#if errorMessage}<div class="notice notice--error" role="alert">{errorMessage}</div>{/if}
{#if successMessage}<div class="notice notice--success" role="status">{successMessage}</div>{/if}
<article class="card adventure-detail"><div class="panel-heading"><div><p class="eyebrow">ADVENTURE WORKSPACE</p><h2>{adventure.name}</h2><p class="muted">所属キャラクター {adventure.characterCount} 人</p></div><div class="toolbar-actions"><button class="button button--quiet" onclick={()=>onNavigate('/adventures')}>一覧へ戻る</button><button class="button button--primary" onclick={()=>void save()} disabled={busy}>変更を保存</button></div></div>
  <div class="adventure-overview-grid">
    <section class="adventure-workspace__episodes"><div class="section-heading"><h3>エピソード進捗</h3><p class="muted">達成済みは開放済みとしても扱われます。</p></div>{#if adventure.episodes.length}<div class="episode-table"><div class="episode-table__header"><span>EP番号</span><span>名前</span><span>悪意適正</span><span>進捗</span></div>{#each adventure.episodes as episode}<div class="episode-table__row"><strong>{episode.displayCode}</strong><span>{episode.name}</span><span>{episode.maliceLevel}</span><select aria-label={`${episode.displayCode} ${episode.name}の進捗`} value={episode.status} onchange={(event)=>onEpisodeStatus(episode.id,(event.currentTarget as HTMLSelectElement).value as EpisodeStatus)}><option value="LOCKED">未開放</option><option value="UNLOCKED">開放済み</option><option value="COMPLETED">達成済み</option></select></div>{/each}</div>{:else}<div class="empty-state">エピソードはまだ登録されていません。</div>{/if}</section>
    <div class="adventure-summary-editor">
      <section class="adventure-editor-section"><h3>特別なアイテム</h3>{#if specialItems.length}<div class="special-item-grid">{#each specialItems as item}<label class="field"><span>{item.name}</span>{#if item.name==='ランタン'}<select bind:value={item.quantity}><option value={0}>未所持</option><option value={1}>所持</option></select>{:else}<input type="number" min="0" bind:value={item.quantity}>{/if}</label>{/each}</div>{:else}<p class="muted">特別なアイテムはまだ登録されていません。</p>{/if}</section>
      <section class="adventure-editor-section"><h3>メモ</h3><label class="field"><span>冒険の共有メモ</span><textarea rows="6" bind:value={memo}></textarea></label></section>
    </div>
  </div>
  <section class="adventure-inventory"><div class="section-heading"><h3>所持品</h3><p class="muted">同じ項目を複数回追加すると、所持数として保存されます。</p></div><div class="adventure-inventory__columns">{#each inventoryColumns as column}<div>{#each column as key}<section class="adventure-editor-section"><h3>{inventoryLabels[key]}</h3><SkillTransfer itemLabel={inventoryLabels[key]} skills={adventure.inventoryOptions[key]} selectedIds={inventory[key]} allowDuplicates={true} onChange={(value)=>{inventory[key]=value.map(Number);inventory={...inventory};}}/></section>{/each}</div>{/each}</div></section>
</article>
