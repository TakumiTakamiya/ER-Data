<script lang="ts">
  export let value:number;
  export let min:number|undefined=undefined;
  export let ariaLabel:string;
  export let compact=false;
  export let onChange:(value:number)=>void=()=>{};
  let editing=false;
  function focusNumber(node:HTMLInputElement){queueMicrotask(()=>{node.focus();node.select();});}
</script>

<span class:compact class="inline-number-edit">
  {#if editing}
    <input use:focusNumber {min} aria-label={ariaLabel} type="number" bind:value oninput={()=>onChange(value)} onblur={()=>editing=false} onkeydown={(event)=>{if(event.key==='Enter')(event.currentTarget as HTMLInputElement).blur();}}>
  {:else}
    <button type="button" aria-label={`${ariaLabel}を編集`} onclick={()=>editing=true}>{value}</button>
  {/if}
</span>
