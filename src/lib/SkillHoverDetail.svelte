<script lang="ts">
  import type { EquipmentSkill, FullSkill } from './types';
  export let skill: EquipmentSkill | FullSkill;
  const isFull=(value:EquipmentSkill|FullSkill):value is FullSkill=>'rankEffects' in value;
</script>

<span class="skill-hover">
  <span class="skill-hover__name">{skill.name}</span>
  <span class="skill-hover__panel" role="tooltip">
    <strong>{skill.name}</strong>
    <span>分類 {skill.classification} · タイミング {skill.timing} · コスト {skill.cost}</span>
    {#if isFull(skill)}
      <span>対象 {skill.target}{skill.maxUses===null?'':` · 最大使用回数 ${skill.maxUses}`}</span>
      {@const categories=[...skill.weaponCategories,...skill.shieldCategories].map(item=>item.name).join('、')}
      {#if categories}<span>対応カテゴリ {categories}</span>{/if}
      {#each skill.rankEffects as effect,index}{#if effect}<span><b>ランク {index+1}</b> {effect}</span>{/if}{/each}
    {:else}
      <span><b>効果</b> {skill.effect}</span>
    {/if}
  </span>
</span>
