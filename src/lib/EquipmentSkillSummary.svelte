<script lang="ts">
  import type { EquipmentSkill } from './types';
  export let skill:EquipmentSkill;
</script>

<article class="equipment-skill">
  <strong>{skill.name}</strong>
  <dl><div><dt>分類</dt><dd>{skill.classification}</dd></div><div><dt>タイミング</dt><dd>{skill.timing}</dd></div><div><dt>コスト</dt><dd>{skill.cost}</dd></div></dl>
  <p><span>効果</span>{skill.effect||'なし'}</p>
</article>
