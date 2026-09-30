<script lang="ts">
  import { addGuardCutSymbol, type GuardCutSymbol } from './guardCut';

  export let label = '';
  export let value = '';
  export let required = false;
  export let onChange: (value: string) => void = () => {};

  function add(symbol: GuardCutSymbol): void {
    onChange(addGuardCutSymbol(value, symbol));
  }
</script>

<div class="field">
  <label><span>{label}</span><input {value} {required} pattern="□*☆*" title="0個以上の□の後に、0個以上の☆を入力してください" oninput={(event)=>onChange((event.currentTarget as HTMLInputElement).value)}></label>
  <div class="shortcut-row" aria-label={`${label}の入力補助`}>
    <button type="button" class="shortcut-button" onclick={()=>add('□')}>□を追加</button>
    <button type="button" class="shortcut-button" onclick={()=>add('☆')}>☆を追加</button>
  </div>
</div>
