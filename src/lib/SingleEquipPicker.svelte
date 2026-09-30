<script lang="ts">
  import type { NamedOption } from './types';

  export let items: NamedOption[] = [];
  export let selectedId: number | null = null;
  export let itemLabel = '防具';
  export let onChange: (id: number | null) => void = () => {};

  let query = '';
  let candidateId: number | '' = '';

  $: available = items.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  $: equipped = items.find((item) => item.id === selectedId) ?? null;

  function equip(): void {
    if (candidateId === '') return;
    onChange(Number(candidateId));
  }
</script>

<div class="skill-transfer single-equip-picker">
  <div class="skill-transfer__column">
    <label class="field"><span>{itemLabel}を検索</span><input bind:value={query} placeholder="名前で絞り込み"></label>
    <label class="field"><span>選択肢一覧</span><select size="8" bind:value={candidateId}>{#each available as item}<option value={item.id}>{item.name}</option>{/each}</select></label>
  </div>
  <div class="skill-transfer__actions">
    <button type="button" class="button button--quiet" onclick={equip} disabled={candidateId==='' }>装備 →</button>
    <button type="button" class="button button--quiet" onclick={()=>onChange(null)} disabled={!equipped}>装備を外す</button>
  </div>
  <label class="field skill-transfer__column"><span>装備中の{itemLabel}</span><select size="4" disabled>{#if equipped}<option selected>{equipped.name}</option>{/if}</select></label>
</div>
