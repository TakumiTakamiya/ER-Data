import type { AbilityKey, AbilityValues, CharacterEquipment, EquipmentCandidate } from './types';

export const requirementKeys: AbilityKey[] = ['strength','dexterity','intelligence','faith','arcane'];

export function missingRequirements(candidate: EquipmentCandidate, abilities: AbilityValues) {
  return requirementKeys.flatMap((key) => {
    const required=candidate.requirements?.[key]??0;
    return abilities[key]<required?[{key,required,current:abilities[key]}]:[];
  });
}

export function equipmentWeight(equipment: CharacterEquipment) {
  return equipment.weaponCategories.flatMap(category=>category.weapons).reduce((sum,item)=>sum+item.weight,0)
    +equipment.shields.reduce((sum,item)=>sum+item.weight,0)
    +[equipment.armors.head,equipment.armors.body].reduce<number>((sum,item)=>sum+(item?.weight??0),0)
    +equipment.talismans.reduce((sum,item)=>sum+item.weight,0);
}

export function evasionFor(endurance:number,weight:number) {
  if(weight<=endurance)return{label:'軽量',cost:6};
  if(weight<=endurance*2)return{label:'中量',cost:8};
  if(weight<=endurance*3)return{label:'重量',cost:10};
  return{label:'重量過多',cost:null};
}

export function activeArmorSet(equipment:CharacterEquipment) {
  const head=equipment.armors.head?.armorSet,body=equipment.armors.body?.armorSet;
  return head&&body&&head.id===body.id?head:null;
}
