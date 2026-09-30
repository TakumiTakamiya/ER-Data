import { describe,expect,it } from 'vitest';
import { evasionFor, missingRequirements } from './characterEquipment';
import type { AbilityValues, EquipmentCandidate } from './types';

const abilities:AbilityValues={vigor:10,mind:10,endurance:10,strength:8,dexterity:7,intelligence:6,faith:5,arcane:4};

describe('missingRequirements',()=>{
  it('不足している能力だけを返す',()=>{
    const item={id:1,name:'武器',quantity:1,weight:1,requirements:{strength:9,dexterity:7,faith:8}} satisfies EquipmentCandidate;
    expect(missingRequirements(item,abilities)).toEqual([{key:'strength',required:9,current:8},{key:'faith',required:8,current:5}]);
  });
});

describe('evasionFor',()=>{
  it.each([[10,'軽量',6],[20,'中量',8],[30,'重量',10],[31,'重量過多',null]] as const)('重量%iを分類する',(weight,label,cost)=>expect(evasionFor(10,weight)).toEqual({label,cost}));
});
