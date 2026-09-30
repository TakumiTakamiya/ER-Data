<script lang="ts">
  type OptionId = number | string;
  type TransferOption = { id: OptionId; name: string };

  export let skills: TransferOption[] = [];
  export let selectedIds: OptionId[] = [];
  export let onChange: (ids: OptionId[]) => void = () => {};
  export let itemLabel = 'スキル';
  export let allowDuplicates = false;

  let query = '';
  let availableSelection: OptionId[] = [];
  let selectedSelection: OptionId[] = [];

  $: selectedSet = new Set(selectedIds);
  $: available = skills.filter((skill) => (allowDuplicates || !selectedSet.has(skill.id)) && skill.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  $: selected = selectedIds.flatMap((id, index) => {
    const skill = skills.find((item) => item.id === id);
    return skill ? [{ ...skill, selectionIndex: index }] : [];
  });

  function add(): void {
    if (!availableSelection.length) return;
    onChange([...selectedIds, ...availableSelection.filter((id) => allowDuplicates || !selectedSet.has(id))]);
    availableSelection = [];
  }

  function remove(): void {
    if (!selectedSelection.length) return;
    if (allowDuplicates) {
      const removing = new Set(selectedSelection.map(Number));
      onChange(selectedIds.filter((_, index) => !removing.has(index)));
    } else {
      const removing = new Set(selectedSelection);
      onChange(selectedIds.filter((id) => !removing.has(id)));
    }
    selectedSelection = [];
  }
</script>

<div class="skill-transfer">
  <div class="skill-transfer__column">
    <label class="field"><span>{itemLabel}を検索</span><input bind:value={query} placeholder="名前で絞り込み"></label>
    <label class="field"><span>選択肢一覧</span><select multiple size="8" bind:value={availableSelection}>{#each available as skill}<option value={skill.id}>{skill.name}</option>{/each}</select></label>
  </div>
  <div class="skill-transfer__actions">
    <button type="button" class="button button--quiet" onclick={add} disabled={!availableSelection.length}>追加 →</button>
    <button type="button" class="button button--quiet" onclick={remove} disabled={!selectedSelection.length}>← 解除</button>
  </div>
  <label class="field skill-transfer__column"><span>選択した{itemLabel}</span><select multiple size="10" bind:value={selectedSelection}>{#each selected as skill}<option value={allowDuplicates?skill.selectionIndex:skill.id}>{skill.name}</option>{/each}</select></label>
</div>
