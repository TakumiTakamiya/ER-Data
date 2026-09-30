import { abilityKeys, type AbilityKey } from '../src/lib/types';

interface D1Result<T = Record<string, unknown>> { results: T[]; success: boolean; meta?: { last_row_id?: number; changes?: number } }
interface D1Statement { bind(...values: unknown[]): D1Statement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<D1Result<T>>; run(): Promise<D1Result> }
interface D1Database { prepare(sql: string): D1Statement; batch<T = Record<string, unknown>>(statements: D1Statement[]): Promise<D1Result<T>[]> }
interface Env { DB: D1Database; ASSETS: { fetch(request: Request): Promise<Response> } }

class HttpError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'VALIDATION_ERROR', 'JSONオブジェクトを送信してください。');
  return value as Record<string, unknown>;
};
const text = (o: Record<string, unknown>, key: string, optional = false) => {
  const value = typeof o[key] === 'string' ? o[key].trim() : '';
  if (!optional && !value) throw new HttpError(400, 'VALIDATION_ERROR', `${key}を入力してください。`);
  return value;
};
const guardCut = (o: Record<string, unknown>, key: string, optional = false) => {
  const value = text(o, key, optional);
  if (!/^□*☆*$/.test(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${key}は□の後に☆が続く形式で入力してください。`);
  return value;
};
const integer = (o: Record<string, unknown>, key: string, min = 0) => {
  const value = Number(o[key]);
  if (!Number.isInteger(value) || value < min) throw new HttpError(400, 'VALIDATION_ERROR', `${key}は${min}以上の整数で入力してください。`);
  return value;
};
const signedInteger = (o: Record<string, unknown>, key: string) => {
  const value = Number(o[key]);
  if (!Number.isInteger(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${key}は整数で入力してください。`);
  return value;
};
const ids = (o: Record<string, unknown>, key: string) => {
  const value = o[key] ?? [];
  if (!Array.isArray(value) || value.some((id) => !Number.isInteger(Number(id)) || Number(id) < 1)) throw new HttpError(400, 'VALIDATION_ERROR', `${key}が不正です。`);
  return [...new Set(value.map(Number))];
};
const orderedIds = (o: Record<string, unknown>, key: string) => {
  const value = o[key] ?? [];
  if (!Array.isArray(value) || value.some((id) => !Number.isInteger(Number(id)) || Number(id) < 1)) throw new HttpError(400, 'VALIDATION_ERROR', `${key}が不正です。`);
  return value.map(Number);
};
const body = async (request: Request) => asObject(await request.json().catch(() => null));
const idFrom = (path: string, pattern: RegExp) => {
  const match = path.match(pattern); const id = Number(match?.[1]);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'NOT_FOUND', '対象が見つかりません。');
  return id;
};
const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(',');

const characterSelect = `SELECT c.*, a.name adventure_name, o.name origin_name,
  o.initial_vigor, o.initial_mind, o.initial_endurance, o.initial_strength,
  o.initial_dexterity, o.initial_intelligence, o.initial_faith, o.initial_arcane,
  COALESCE((SELECT quantity FROM adventure_special_items WHERE adventure_id=c.adventure_id AND special_item_id=5),0) golden_seeds,
  COALESCE((SELECT quantity FROM adventure_special_items WHERE adventure_id=c.adventure_id AND special_item_id=6),0) sacred_tears,
  COALESCE((SELECT quantity FROM adventure_special_items WHERE adventure_id=c.adventure_id AND special_item_id=7),0) memory_stones,
  COALESCE((SELECT quantity FROM adventure_special_items WHERE adventure_id=c.adventure_id AND special_item_id=8),0) talisman_pouches
  FROM characters c JOIN adventures a ON a.id=c.adventure_id JOIN origins o ON o.id=c.origin_id`;

function mapCharacter(row: Record<string, unknown>) {
  const abilities = Object.fromEntries(abilityKeys.map((key) => {
    const initial = Number(row[`initial_${key}`]); const growth = Number(row[`${key}_growth`]); const bonus = Number(row[`${key}_bonus`]);
    return [key, { initial, growth, bonus, total: initial + growth + bonus }];
  }));
  return { id: row.id, name: row.name, level: row.level, adventureId: row.adventure_id, adventureName: row.adventure_name,
    originId: row.origin_id, originName: row.origin_name, runes: row.runes, materialPoints: row.material_points, abilities,
    resources:{maxHpModifier:Number(row.max_hp_modifier),maxFpModifier:Number(row.max_fp_modifier),maxBlessingModifier:Number(row.max_blessing_modifier),flaskTotalModifier:Number(row.flask_total_modifier),crimsonFlaskHealModifier:Number(row.crimson_flask_heal_modifier),crimsonFlaskAllocation:Number(row.crimson_flask_allocation),ceruleanFlaskHealModifier:Number(row.cerulean_flask_heal_modifier),ceruleanFlaskAllocation:Number(row.cerulean_flask_allocation)},
    adventureResources:{goldenSeeds:Number(row.golden_seeds),sacredTears:Number(row.sacred_tears),memoryStones:Number(row.memory_stones),talismanPouches:Number(row.talisman_pouches)} };
}

function characterValues(input: Record<string, unknown>) {
  const growth = asObject(input.growth); const bonus = asObject(input.bonus);
  const resources = asObject(input.resources);
  return [integer(input, 'adventureId', 1), integer(input, 'originId', 1), text(input, 'name'), integer(input, 'level'), integer(input, 'runes'), integer(input, 'materialPoints'),
    ...abilityKeys.map((key) => integer(growth, key)), ...abilityKeys.map((key) => signedInteger(bonus, key)),
    signedInteger(resources,'maxHpModifier'),signedInteger(resources,'maxFpModifier'),signedInteger(resources,'maxBlessingModifier'),signedInteger(resources,'flaskTotalModifier'),
    signedInteger(resources,'crimsonFlaskHealModifier'),integer(resources,'crimsonFlaskAllocation'),signedInteger(resources,'ceruleanFlaskHealModifier'),integer(resources,'ceruleanFlaskAllocation')];
}

function goldenSeedIncrease(quantity:number){return quantity>=36?5:quantity>=26?4:quantity>=18?3:quantity>=11?2:quantity>=5?1:0;}

async function validateFlaskAllocation(db:D1Database,adventureId:number,values:unknown[]){
  const row=await db.prepare('SELECT COALESCE(quantity,0) quantity FROM adventure_special_items WHERE adventure_id=? AND special_item_id=5').bind(adventureId).first();
  const total=Math.max(0,Math.min(10,4+goldenSeedIncrease(Number(row?.quantity??0))+Number(values[25])));
  if(Number(values[27])+Number(values[29])>total)throw new HttpError(400,'VALIDATION_ERROR','緋色と青色の聖杯瓶の振り分け数が合計値を超えています。');
}

const numberValue=(value:unknown)=>Number(value);
const stringValue=(value:unknown)=>String(value??'');

async function getCharacterDetail(db:D1Database,id:number){
  const row=await db.prepare(`${characterSelect} WHERE c.id=?`).bind(id).first();
  if(!row)throw new HttpError(404,'NOT_FOUND','キャラクターが見つかりません。');
  const adventureId=numberValue(row.adventure_id);
  const [weaponRows,shieldRows,armorRows,talismanRows,skillRows,effectRows,skillWeaponRows,skillShieldRows,weaponSkillRows,categorySkillRows,shieldSkillRows,armorSkillRows,setSkillRows,learnedSetRows,setMemberRows,learnedSkillRows,weaponOptions,shieldOptions,armorOptions,talismanOptions,setOptions]=await Promise.all([
    db.prepare(`SELECT cs.id slot_id,cs.position,cs.reinforcement_level,w.*,wc.name category_name,wc.attack_cost,wc.one_hand_damage_1,wc.one_hand_damage_2,wc.one_hand_damage_3,wc.one_hand_damage_4,wc.one_hand_damage_5,wc.two_hand_damage_1,wc.two_hand_damage_2,wc.two_hand_damage_3,wc.two_hand_damage_4,wc.two_hand_damage_5,wc.guard_cost,wc.two_hand_physical_guard,wc.two_hand_phenomenon_guard FROM character_weapon_slots cs JOIN weapons w ON w.id=cs.weapon_id JOIN weapon_categories wc ON wc.id=w.weapon_category_id WHERE cs.character_id=? ORDER BY wc.name,cs.position`).bind(id).all(),
    db.prepare(`SELECT cs.id slot_id,cs.position,cs.reinforcement_level,s.*,sc.name category_name FROM character_shield_slots cs JOIN shields s ON s.id=cs.shield_id JOIN shield_categories sc ON sc.id=s.shield_category_id WHERE cs.character_id=? ORDER BY cs.position`).bind(id).all(),
    db.prepare(`SELECT a.*,s.name armor_set_name,s.series_effect FROM character_equipped_armors ca JOIN armors a ON a.id=ca.armor_id LEFT JOIN armor_sets s ON s.id=a.armor_set_id WHERE ca.character_id=?`).bind(id).all(),
    db.prepare(`SELECT ct.id slot_id,ct.position,t.* FROM character_equipped_talismans ct JOIN talismans t ON t.id=ct.talisman_id WHERE ct.character_id=? ORDER BY ct.position`).bind(id).all(),
    db.prepare('SELECT * FROM skills ORDER BY name').all(),
    db.prepare('SELECT skill_id,rank,effect FROM skill_rank_effects ORDER BY rank').all(),
    db.prepare('SELECT link.skill_id,c.id,c.name FROM skill_weapon_categories link JOIN weapon_categories c ON c.id=link.weapon_category_id ORDER BY c.name').all(),
    db.prepare('SELECT link.skill_id,c.id,c.name FROM skill_shield_categories link JOIN shield_categories c ON c.id=link.shield_category_id ORDER BY c.name').all(),
    db.prepare('SELECT weapon_id,skill_id FROM weapon_skills').all(),
    db.prepare('SELECT weapon_category_id,skill_id FROM weapon_category_skills').all(),
    db.prepare('SELECT shield_id,skill_id FROM shield_skills').all(),
    db.prepare('SELECT armor_id,skill_id FROM armor_skills').all(),
    db.prepare('SELECT armor_set_id,skill_id FROM armor_set_skills').all(),
    db.prepare(`SELECT ls.skill_set_id,s.name,s.notes FROM character_learned_skill_sets ls JOIN skill_sets s ON s.id=ls.skill_set_id WHERE ls.character_id=? ORDER BY s.name`).bind(id).all(),
    db.prepare('SELECT skill_set_id,skill_id,position FROM skill_set_members ORDER BY position').all(),
    db.prepare('SELECT id row_id,skill_id,position,rank FROM character_equipped_skills WHERE character_id=? ORDER BY position').bind(id).all(),
    db.prepare(`SELECT aw.weapon_id id,w.name,w.weight,w.power_modifier,w.required_strength,w.required_dexterity,w.required_intelligence,w.required_faith,w.required_arcane,wc.name category_name,aw.quantity FROM adventure_weapons aw JOIN weapons w ON w.id=aw.weapon_id JOIN weapon_categories wc ON wc.id=w.weapon_category_id WHERE aw.adventure_id=? AND aw.quantity>0 ORDER BY wc.name,w.name`).bind(adventureId).all(),
    db.prepare(`SELECT ash.shield_id id,s.name,s.weight,s.required_strength,s.required_dexterity,s.required_intelligence,s.required_faith,s.required_arcane,sc.name category_name,ash.quantity FROM adventure_shields ash JOIN shields s ON s.id=ash.shield_id JOIN shield_categories sc ON sc.id=s.shield_category_id WHERE ash.adventure_id=? AND ash.quantity>0 ORDER BY sc.name,s.name`).bind(adventureId).all(),
    db.prepare(`SELECT aa.armor_id id,a.name,a.weight,a.armor_slot slot,aa.quantity FROM adventure_armors aa JOIN armors a ON a.id=aa.armor_id WHERE aa.adventure_id=? AND aa.quantity>0 ORDER BY a.armor_slot,a.name`).bind(adventureId).all(),
    db.prepare(`SELECT at.talisman_id id,t.name,t.weight,t.effect,at.quantity FROM adventure_talismans at JOIN talismans t ON t.id=at.talisman_id WHERE at.adventure_id=? AND at.quantity>0 ORDER BY t.name`).bind(adventureId).all(),
    db.prepare(`SELECT ass.skill_set_id id,s.name,s.notes,ass.quantity FROM adventure_skill_sets ass JOIN skill_sets s ON s.id=ass.skill_set_id WHERE ass.adventure_id=? AND ass.quantity>0 ORDER BY s.name`).bind(adventureId).all()
  ]);
  const skillMap=new Map<number,Record<string,unknown>>();
  for(const skill of skillRows.results){
    const skillId=numberValue(skill.id);
    const effects=effectRows.results.filter(effect=>numberValue(effect.skill_id)===skillId).sort((a,b)=>numberValue(a.rank)-numberValue(b.rank)).map(effect=>stringValue(effect.effect));
    skillMap.set(skillId,{id:skillId,name:stringValue(skill.name),classification:stringValue(skill.classification),timing:stringValue(skill.timing),target:stringValue(skill.target),cost:stringValue(skill.cost),maxUses:skill.max_uses===null?null:numberValue(skill.max_uses),rankEffects:effects,weaponCategories:skillWeaponRows.results.filter(link=>numberValue(link.skill_id)===skillId).map(link=>({id:numberValue(link.id),name:stringValue(link.name)})),shieldCategories:skillShieldRows.results.filter(link=>numberValue(link.skill_id)===skillId).map(link=>({id:numberValue(link.id),name:stringValue(link.name)}))});
  }
  const equipmentSkill=(skillId:number)=>{const skill=skillMap.get(skillId)!;return{id:skill.id,name:skill.name,classification:skill.classification,timing:skill.timing,cost:skill.cost,effect:(skill.rankEffects as string[])[0]??''};};
  const skillsFor=(links:Record<string,unknown>[],fk:string,value:number)=>links.filter(link=>numberValue(link[fk])===value).map(link=>equipmentSkill(numberValue(link.skill_id)));
  const categoryMap=new Map<number,Record<string,unknown>>();
  for(const weapon of weaponRows.results){
    const categoryId=numberValue(weapon.weapon_category_id);
    if(!categoryMap.has(categoryId))categoryMap.set(categoryId,{id:categoryId,name:stringValue(weapon.category_name),attackCost:numberValue(weapon.attack_cost),oneHandDamage:[1,2,3,4,5].map(hit=>stringValue(weapon[`one_hand_damage_${hit}`])),twoHandDamage:[1,2,3,4,5].map(hit=>stringValue(weapon[`two_hand_damage_${hit}`])),guardCost:numberValue(weapon.guard_cost),physicalGuard:stringValue(weapon.two_hand_physical_guard),phenomenonGuard:stringValue(weapon.two_hand_phenomenon_guard),skills:skillsFor(categorySkillRows.results,'weapon_category_id',categoryId),weapons:[]});
    (categoryMap.get(categoryId)!.weapons as Record<string,unknown>[]).push({slotId:numberValue(weapon.slot_id),position:numberValue(weapon.position),reinforcementLevel:numberValue(weapon.reinforcement_level),id:numberValue(weapon.id),name:stringValue(weapon.name),weight:numberValue(weapon.weight),powerModifier:stringValue(weapon.power_modifier),skills:skillsFor(weaponSkillRows.results,'weapon_id',numberValue(weapon.id))});
  }
  const armorFor=(slot:string)=>{const armor=armorRows.results.find(item=>item.armor_slot===slot);if(!armor)return null;const setId=armor.armor_set_id===null?null:numberValue(armor.armor_set_id);return{id:numberValue(armor.id),name:stringValue(armor.name),slot:stringValue(armor.armor_slot),weight:numberValue(armor.weight),physicalCut:numberValue(armor.physical_cut),phenomenonCut:numberValue(armor.phenomenon_cut),poise:numberValue(armor.poise),armorSet:setId===null?null:{id:setId,name:stringValue(armor.armor_set_name),seriesEffect:stringValue(armor.series_effect),skills:skillsFor(setSkillRows.results,'armor_set_id',setId)},skills:skillsFor(armorSkillRows.results,'armor_id',numberValue(armor.id))};};
  const fullSkill=(skillId:number)=>skillMap.get(skillId)!;
  const learnedSkillSets=learnedSetRows.results.map(set=>({id:numberValue(set.skill_set_id),name:stringValue(set.name),notes:stringValue(set.notes),skills:setMemberRows.results.filter(member=>numberValue(member.skill_set_id)===numberValue(set.skill_set_id)).map(member=>fullSkill(numberValue(member.skill_id)))}));
  const learnedSkills=learnedSkillRows.results.map(item=>{const skill=fullSkill(numberValue(item.skill_id));const highestRank=Math.max(1,...(skill.rankEffects as string[]).map((effect,index)=>stringValue(effect).trim()?index+1:0));return{...skill,rowId:numberValue(item.row_id),position:numberValue(item.position),rank:numberValue(item.rank),highestRank};});
  const requirements=(item:Record<string,unknown>)=>({strength:numberValue(item.required_strength),dexterity:numberValue(item.required_dexterity),intelligence:numberValue(item.required_intelligence),faith:numberValue(item.required_faith),arcane:numberValue(item.required_arcane)});
  return {...mapCharacter(row),equipment:{weaponCategories:[...categoryMap.values()],shields:shieldRows.results.map(shield=>({slotId:numberValue(shield.slot_id),position:numberValue(shield.position),reinforcementLevel:numberValue(shield.reinforcement_level),id:numberValue(shield.id),name:stringValue(shield.name),categoryName:stringValue(shield.category_name),weight:numberValue(shield.weight),guardCost:numberValue(shield.guard_cost),physicalGuard:stringValue(shield.physical_guard),phenomenonGuard:stringValue(shield.phenomenon_guard),skills:skillsFor(shieldSkillRows.results,'shield_id',numberValue(shield.id))})),armors:{head:armorFor('HEAD'),body:armorFor('BODY')},talismans:talismanRows.results.map(item=>({slotId:numberValue(item.slot_id),position:numberValue(item.position),id:numberValue(item.id),name:stringValue(item.name),weight:numberValue(item.weight),effect:stringValue(item.effect)}))},inventoryOptions:{weapons:weaponOptions.results.map(item=>({id:numberValue(item.id),name:stringValue(item.name),quantity:numberValue(item.quantity),weight:numberValue(item.weight),categoryName:stringValue(item.category_name),requirements:requirements(item),kind:'weapon',powerModifier:stringValue(item.power_modifier),skills:skillsFor(weaponSkillRows.results,'weapon_id',numberValue(item.id))})),shields:shieldOptions.results.map(item=>({id:numberValue(item.id),name:stringValue(item.name),quantity:numberValue(item.quantity),weight:numberValue(item.weight),categoryName:stringValue(item.category_name),requirements:requirements(item),kind:'shield',skills:skillsFor(shieldSkillRows.results,'shield_id',numberValue(item.id))})),armors:armorOptions.results.map(item=>({id:numberValue(item.id),name:stringValue(item.name),quantity:numberValue(item.quantity),weight:numberValue(item.weight),slot:stringValue(item.slot)})),talismans:talismanOptions.results.map(item=>({id:numberValue(item.id),name:stringValue(item.name),quantity:numberValue(item.quantity),weight:numberValue(item.weight),effect:stringValue(item.effect)})),skillSets:setOptions.results.map(item=>({id:numberValue(item.id),name:stringValue(item.name),notes:stringValue(item.notes),quantity:numberValue(item.quantity)}))},learnedSkillSets,learnedSkills};
}

async function assertReferences(db: D1Database, pairs: [string, number][]) {
  for (const [table, id] of pairs) if (!await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(id).first()) throw new HttpError(400, 'INVALID_REFERENCE', '選択された関連データが存在しません。');
}

async function adventures(db: D1Database, request: Request) {
  if (request.method === 'GET') return json((await db.prepare(`SELECT a.id,a.name,a.memo,COUNT(c.id) character_count FROM adventures a LEFT JOIN characters c ON c.adventure_id=a.id GROUP BY a.id ORDER BY a.name`).all()).results.map(r => ({ id:r.id,name:r.name,memo:r.memo,characterCount:Number(r.character_count) })));
  const input = await body(request); const name = text(input, 'name'); const memo = text(input, 'memo', true);
  const result = await db.prepare('INSERT INTO adventures(name,memo) VALUES(?,?)').bind(name,memo).run();
  return json({ id: result.meta?.last_row_id, name, memo, characterCount: 0 }, 201);
}

async function adventureById(db: D1Database, request: Request, path: string) {
  const id=idFrom(path,/^\/api\/adventures\/(\d+)$/);
  if(request.method==='GET'){
    const adventure=await db.prepare(`SELECT a.id,a.name,a.memo,COUNT(c.id) character_count FROM adventures a LEFT JOIN characters c ON c.adventure_id=a.id WHERE a.id=? GROUP BY a.id`).bind(id).first();
    if(!adventure)throw new HttpError(404,'NOT_FOUND','冒険が見つかりません。');
    const inventoryDefs=[['weapons','weapons','adventure_weapons','weapon_id'],['shields','shields','adventure_shields','shield_id'],['armors','armors','adventure_armors','armor_id'],['talismans','talismans','adventure_talismans','talisman_id'],['skillSets','skill_sets','adventure_skill_sets','skill_set_id'],['spiritAshes','spirit_ashes','adventure_spirit_ashes','spirit_ash_id']] as const;
    const [episodes,specialItems,inventoryRows]=await Promise.all([
      db.prepare(`SELECT e.*,p.status FROM episodes e LEFT JOIN adventure_episode_progress p ON p.episode_id=e.id AND p.adventure_id=? ORDER BY CASE e.episode_type WHEN 'MAIN' THEN 0 ELSE 1 END,e.episode_number`).bind(id).all(),
      db.prepare(`SELECT s.id,s.name,COALESCE(a.quantity,0) quantity FROM special_items s LEFT JOIN adventure_special_items a ON a.special_item_id=s.id AND a.adventure_id=? ORDER BY s.id`).bind(id).all(),
      Promise.all(inventoryDefs.map(async([key,master,link,fk])=>({key,options:(await db.prepare(`SELECT id,name FROM ${master} ORDER BY name`).all()).results,owned:(await db.prepare(`SELECT ${fk} item_id,quantity FROM ${link} WHERE adventure_id=?`).bind(id).all()).results})))
    ]);
    const inventoryOptions=Object.fromEntries(inventoryRows.map(row=>[row.key,row.options.map(item=>({id:Number(item.id),name:String(item.name)}))]));
    const inventory=Object.fromEntries(inventoryRows.map(row=>[row.key,row.owned.flatMap(item=>Array.from({length:Number(item.quantity)},()=>Number(item.item_id)))]));
    return json({id:Number(adventure.id),name:String(adventure.name),memo:String(adventure.memo),characterCount:Number(adventure.character_count),episodes:episodes.results.map(episode=>({id:Number(episode.id),name:String(episode.name),episodeType:String(episode.episode_type),episodeNumber:Number(episode.episode_number),displayCode:String(episode.display_code),maliceLevel:Number(episode.malice_level),status:episode.status??'LOCKED'})),specialItems:specialItems.results.map(item=>({id:Number(item.id),name:String(item.name),quantity:Number(item.quantity)})),inventory,inventoryOptions});
  }
  if (request.method !== 'PUT') throw new HttpError(405,'METHOD_NOT_ALLOWED','未対応の操作です。');
  const input=await body(request); const name=text(input,'name'); const memo=text(input,'memo',true);
  if (!await db.prepare('SELECT id FROM adventures WHERE id=?').bind(id).first()) throw new HttpError(404,'NOT_FOUND','冒険が見つかりません。');
  await db.prepare('UPDATE adventures SET name=?,memo=? WHERE id=?').bind(name,memo,id).run(); return json({id,name,memo});
}

async function adventureContents(db:D1Database,request:Request,path:string){
  const adventureId=idFrom(path,/^\/api\/adventures\/(\d+)\/contents$/);if(!await db.prepare('SELECT id FROM adventures WHERE id=?').bind(adventureId).first())throw new HttpError(404,'NOT_FOUND','冒険が見つかりません。');
  const input=await body(request);const inventory=asObject(input.inventory);const inventoryDefs=[['weapons','weapons','adventure_weapons','weapon_id'],['shields','shields','adventure_shields','shield_id'],['armors','armors','adventure_armors','armor_id'],['talismans','talismans','adventure_talismans','talisman_id'],['skillSets','skill_sets','adventure_skill_sets','skill_set_id'],['spiritAshes','spirit_ashes','adventure_spirit_ashes','spirit_ash_id']] as const;
  const owned=Object.fromEntries(inventoryDefs.map(([key])=>[key,orderedIds(inventory,key)])) as Record<string,number[]>;
  const specialItems=Array.isArray(input.specialItems)?input.specialItems:[];const parsedSpecial=specialItems.map(value=>{const item=asObject(value);return{id:integer(item,'id',1),quantity:integer(item,'quantity')};});
  await assertReferences(db,[...inventoryDefs.flatMap(([key,master])=>[...new Set(owned[key])].map(itemId=>[master,itemId] as [string,number])),...parsedSpecial.map(item=>['special_items',item.id] as [string,number])]);
  const statements:D1Statement[]=[db.prepare('UPDATE adventures SET memo=? WHERE id=?').bind(text(input,'memo',true),adventureId),db.prepare('DELETE FROM adventure_special_items WHERE adventure_id=?').bind(adventureId)];
  parsedSpecial.filter(item=>item.quantity>0).forEach(item=>statements.push(db.prepare('INSERT INTO adventure_special_items(adventure_id,special_item_id,quantity) VALUES(?,?,?)').bind(adventureId,item.id,item.quantity)));
  for(const [key,,link,fk] of inventoryDefs){statements.push(db.prepare(`DELETE FROM ${link} WHERE adventure_id=?`).bind(adventureId));const counts=new Map<number,number>();owned[key].forEach(itemId=>counts.set(itemId,(counts.get(itemId)??0)+1));for(const [itemId,quantity] of counts)statements.push(db.prepare(`INSERT INTO ${link}(adventure_id,${fk},quantity) VALUES(?,?,?)`).bind(adventureId,itemId,quantity));}
  await db.batch(statements);return json({ok:true});
}

async function adventureEpisodeProgress(db:D1Database,request:Request,path:string){
  const match=path.match(/^\/api\/adventures\/(\d+)\/episodes\/(\d+)$/);const adventureId=Number(match?.[1]),episodeId=Number(match?.[2]);
  if(!Number.isInteger(adventureId)||!Number.isInteger(episodeId))throw new HttpError(404,'NOT_FOUND','対象が見つかりません。');
  await assertReferences(db,[['adventures',adventureId],['episodes',episodeId]]);const input=await body(request);const status=text(input,'status').toUpperCase();
  if(status==='LOCKED')await db.prepare('DELETE FROM adventure_episode_progress WHERE adventure_id=? AND episode_id=?').bind(adventureId,episodeId).run();
  else if(['UNLOCKED','COMPLETED'].includes(status))await db.prepare(`INSERT INTO adventure_episode_progress(adventure_id,episode_id,status) VALUES(?,?,?) ON CONFLICT(adventure_id,episode_id) DO UPDATE SET status=excluded.status`).bind(adventureId,episodeId,status).run();
  else throw new HttpError(400,'VALIDATION_ERROR','進捗状態が不正です。');
  return json({ok:true,status});
}

async function origins(db: D1Database) {
  const [originRows,setRows,skillRows,effectRows,weaponRows,shieldRows,armorRows]=await Promise.all([
    db.prepare('SELECT * FROM origins ORDER BY name').all(),
    db.prepare(`SELECT link.origin_id,s.id,s.name,s.notes FROM origin_initial_skill_sets link JOIN skill_sets s ON s.id=link.skill_set_id ORDER BY s.name`).all(),
    db.prepare(`SELECT m.skill_set_id,s.id,s.name,s.classification,s.timing,s.target,s.cost,s.max_uses,m.position FROM skill_set_members m JOIN skills s ON s.id=m.skill_id ORDER BY m.position`).all(),
    db.prepare('SELECT skill_id,rank,effect FROM skill_rank_effects ORDER BY rank').all(),
    db.prepare(`SELECT link.origin_id,w.id,w.name,link.position FROM origin_initial_weapons link JOIN weapons w ON w.id=link.weapon_id ORDER BY link.position`).all(),
    db.prepare(`SELECT link.origin_id,s.id,s.name,link.position FROM origin_initial_shields link JOIN shields s ON s.id=link.shield_id ORDER BY link.position`).all(),
    db.prepare(`SELECT link.origin_id,link.armor_slot,a.id,a.name FROM origin_initial_armors link JOIN armors a ON a.id=link.armor_id`).all()
  ]);
  const effectsFor=(skillId:unknown)=>effectRows.results.filter(row=>row.skill_id===skillId).map(row=>String(row.effect));
  return json(originRows.results.map(r=>({
    id:r.id,name:r.name,initialLevel:r.initial_level,initial:Object.fromEntries(abilityKeys.map(k=>[k,Number(r[`initial_${k}`])])),
    skillSets:setRows.results.filter(set=>set.origin_id===r.id).map(set=>({id:Number(set.id),name:String(set.name),notes:String(set.notes??''),skills:skillRows.results.filter(skill=>skill.skill_set_id===set.id).map(skill=>({id:Number(skill.id),name:String(skill.name),classification:String(skill.classification),timing:String(skill.timing),target:String(skill.target),cost:String(skill.cost),maxUses:skill.max_uses===null?null:Number(skill.max_uses),rankEffects:effectsFor(skill.id)}))})),
    weapons:weaponRows.results.filter(row=>row.origin_id===r.id).map(row=>({id:Number(row.id),name:String(row.name)})),
    shields:shieldRows.results.filter(row=>row.origin_id===r.id).map(row=>({id:Number(row.id),name:String(row.name)})),
    armors:{
      head:(()=>{const row=armorRows.results.find(item=>item.origin_id===r.id&&item.armor_slot==='HEAD');return row?{id:Number(row.id),name:String(row.name)}:null;})(),
      body:(()=>{const row=armorRows.results.find(item=>item.origin_id===r.id&&item.armor_slot==='BODY');return row?{id:Number(row.id),name:String(row.name)}:null;})()
    }
  })));
}

async function characters(db: D1Database, request: Request, url: URL) {
  if (request.method === 'GET') {
    const adventureId=Number(url.searchParams.get('adventureId')); const where=Number.isInteger(adventureId)&&adventureId>0?' WHERE c.adventure_id=?':'';
    const statement=db.prepare(`${characterSelect}${where} ORDER BY c.name`); const rows=(await (where?statement.bind(adventureId):statement).all()).results;
    return json(rows.map(mapCharacter));
  }
  const input=await body(request);const adventureId=integer(input,'adventureId',1);const originId=integer(input,'originId',1);
  await assertReferences(db,[['adventures',adventureId],['origins',originId]]);
  const origin=await db.prepare('SELECT initial_level FROM origins WHERE id=?').bind(originId).first();
  const creationInput={...input,adventureId,originId,level:Number(origin!.initial_level),runes:0,materialPoints:0,growth:Object.fromEntries(abilityKeys.map(key=>[key,0])),bonus:Object.fromEntries(abilityKeys.map(key=>[key,0])),resources:{maxHpModifier:0,maxFpModifier:0,maxBlessingModifier:0,flaskTotalModifier:0,crimsonFlaskHealModifier:0,crimsonFlaskAllocation:0,ceruleanFlaskHealModifier:0,ceruleanFlaskAllocation:0}};
  const values=characterValues(creationInput);
  const cols=['adventure_id','origin_id','name','level','runes','material_points',...abilityKeys.map(k=>`${k}_growth`),...abilityKeys.map(k=>`${k}_bonus`),'max_hp_modifier','max_fp_modifier','max_blessing_modifier','flask_total_modifier','crimson_flask_heal_modifier','crimson_flask_allocation','cerulean_flask_heal_modifier','cerulean_flask_allocation'];
  const result=await db.prepare(`INSERT INTO characters(${cols.join(',')}) VALUES(${placeholders(cols.length)})`).bind(...values).run();
  const characterId=Number(result.meta?.last_row_id);
  await db.batch([
    db.prepare(`INSERT INTO character_weapon_slots(character_id,weapon_id,position,reinforcement_level) SELECT ?,weapon_id,position,0 FROM origin_initial_weapons WHERE origin_id=? ORDER BY position`).bind(characterId,originId),
    db.prepare(`INSERT INTO character_shield_slots(character_id,shield_id,position,reinforcement_level) SELECT ?,shield_id,position,0 FROM origin_initial_shields WHERE origin_id=? ORDER BY position`).bind(characterId,originId),
    db.prepare(`INSERT INTO character_equipped_armors(character_id,armor_slot,armor_id) SELECT ?,armor_slot,armor_id FROM origin_initial_armors WHERE origin_id=?`).bind(characterId,originId),
    db.prepare(`INSERT INTO character_learned_skill_sets(character_id,skill_set_id) SELECT ?,skill_set_id FROM origin_initial_skill_sets WHERE origin_id=?`).bind(characterId,originId)
  ]);
  return json(await getCharacterDetail(db,characterId),201);
}

async function characterById(db:D1Database,request:Request,path:string) {
  const id=idFrom(path,/^\/api\/characters\/(\d+)$/);
  if(request.method==='GET')return json(await getCharacterDetail(db,id));
  if(request.method!=='PUT')throw new HttpError(405,'METHOD_NOT_ALLOWED','未対応の操作です。');
  const input=await body(request);const values=characterValues(input);await assertReferences(db,[['adventures',values[0] as number],['origins',values[1] as number]]);await validateFlaskAllocation(db,values[0] as number,values);
  const cols=['adventure_id','origin_id','name','level','runes','material_points',...abilityKeys.map(k=>`${k}_growth`),...abilityKeys.map(k=>`${k}_bonus`),'max_hp_modifier','max_fp_modifier','max_blessing_modifier','flask_total_modifier','crimson_flask_heal_modifier','crimson_flask_allocation','cerulean_flask_heal_modifier','cerulean_flask_allocation'];
  if(!await db.prepare('SELECT id FROM characters WHERE id=?').bind(id).first())throw new HttpError(404,'NOT_FOUND','キャラクターが見つかりません。');
  await db.prepare(`UPDATE characters SET ${cols.map(c=>`${c}=?`).join(',')} WHERE id=?`).bind(...values,id).run();
  return json(await getCharacterDetail(db,id));
}

async function characterContext(db:D1Database,id:number){
  const row=await db.prepare(`${characterSelect} WHERE c.id=?`).bind(id).first();
  if(!row)throw new HttpError(404,'NOT_FOUND','キャラクターが見つかりません。');
  return{row,adventureId:numberValue(row.adventure_id),abilities:Object.fromEntries(abilityKeys.map(key=>[key,numberValue(row[`initial_${key}`])+numberValue(row[`${key}_growth`])+numberValue(row[`${key}_bonus`])])) as Record<AbilityKey,number>};
}

function validateRequirements(item:Record<string,unknown>,abilities:Record<AbilityKey,number>){
  const missing=(['strength','dexterity','intelligence','faith','arcane'] as AbilityKey[]).filter(key=>abilities[key]<numberValue(item[`required_${key}`]));
  if(missing.length)throw new HttpError(400,'REQUIREMENTS_NOT_MET','必要能力値を満たしていません。');
}

async function equipWeaponOrShield(db:D1Database,request:Request,characterId:number,kind:'weapon'|'shield'){
  const input=await body(request),itemId=integer(input,'itemId',1),context=await characterContext(db,characterId);
  const plural=kind==='weapon'?'weapons':'shields',link=`adventure_${plural}`,fk=`${kind}_id`,slots=`character_${kind}_slots`;
  const item=await db.prepare(`SELECT * FROM ${plural} WHERE id=?`).bind(itemId).first();if(!item)throw new HttpError(404,'NOT_FOUND','装備が見つかりません。');validateRequirements(item,context.abilities);
  const results=await db.batch([
    db.prepare(`INSERT INTO ${slots}(character_id,${fk},position,reinforcement_level) SELECT ?,?,COALESCE((SELECT MAX(position)+1 FROM ${slots} WHERE character_id=?),1),0 WHERE EXISTS(SELECT 1 FROM ${link} WHERE adventure_id=? AND ${fk}=? AND quantity>0)`).bind(characterId,itemId,characterId,context.adventureId,itemId),
    db.prepare(`DELETE FROM ${link} WHERE adventure_id=? AND ${fk}=? AND quantity=1`).bind(context.adventureId,itemId),
    db.prepare(`UPDATE ${link} SET quantity=quantity-1 WHERE adventure_id=? AND ${fk}=? AND quantity>1`).bind(context.adventureId,itemId)
  ]);
  if(Number(results[0].meta?.changes??0)!==1)throw new HttpError(409,'OUT_OF_STOCK','冒険の所持品に対象の装備がありません。');return json(await getCharacterDetail(db,characterId));
}

async function unequipWeaponOrShield(db:D1Database,characterId:number,slotId:number,kind:'weapon'|'shield'){
  const context=await characterContext(db,characterId),plural=kind==='weapon'?'weapons':'shields',link=`adventure_${plural}`,fk=`${kind}_id`,slots=`character_${kind}_slots`;
  const slot=await db.prepare(`SELECT ${fk} item_id FROM ${slots} WHERE id=? AND character_id=?`).bind(slotId,characterId).first();if(!slot)throw new HttpError(404,'NOT_FOUND','装備枠が見つかりません。');const itemId=numberValue(slot.item_id);
  await db.batch([db.prepare(`DELETE FROM ${slots} WHERE id=? AND character_id=?`).bind(slotId,characterId),db.prepare(`INSERT INTO ${link}(adventure_id,${fk},quantity) VALUES(?,?,1) ON CONFLICT(adventure_id,${fk}) DO UPDATE SET quantity=quantity+1`).bind(context.adventureId,itemId)]);return json(await getCharacterDetail(db,characterId));
}

async function changeArmor(db:D1Database,request:Request,characterId:number,slotName:string){
  const slot=slotName.toUpperCase();if(!['HEAD','BODY'].includes(slot))throw new HttpError(404,'NOT_FOUND','防具部位が見つかりません。');const input=await body(request),armorId=integer(input,'itemId',1),context=await characterContext(db,characterId);
  const armor=await db.prepare('SELECT id,armor_slot FROM armors WHERE id=?').bind(armorId).first();if(!armor||armor.armor_slot!==slot)throw new HttpError(400,'INVALID_SLOT','防具の部位が一致しません。');
  const old=await db.prepare('SELECT armor_id FROM character_equipped_armors WHERE character_id=? AND armor_slot=?').bind(characterId,slot).first();if(numberValue(old?.armor_id)===armorId)return json(await getCharacterDetail(db,characterId));
  const statements=[db.prepare(`INSERT OR REPLACE INTO character_equipped_armors(character_id,armor_slot,armor_id) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM adventure_armors WHERE adventure_id=? AND armor_id=? AND quantity>0)`).bind(characterId,slot,armorId,context.adventureId,armorId),db.prepare('DELETE FROM adventure_armors WHERE adventure_id=? AND armor_id=? AND quantity=1').bind(context.adventureId,armorId),db.prepare('UPDATE adventure_armors SET quantity=quantity-1 WHERE adventure_id=? AND armor_id=? AND quantity>1').bind(context.adventureId,armorId)];
  if(old)statements.push(db.prepare('INSERT INTO adventure_armors(adventure_id,armor_id,quantity) VALUES(?,?,1) ON CONFLICT(adventure_id,armor_id) DO UPDATE SET quantity=quantity+1').bind(context.adventureId,numberValue(old.armor_id)));
  const results=await db.batch(statements);if(Number(results[0].meta?.changes??0)!==1)throw new HttpError(409,'OUT_OF_STOCK','冒険の所持品に対象の防具がありません。');return json(await getCharacterDetail(db,characterId));
}

async function removeArmor(db:D1Database,characterId:number,slotName:string){
  const slot=slotName.toUpperCase();if(!['HEAD','BODY'].includes(slot))throw new HttpError(404,'NOT_FOUND','防具部位が見つかりません。');const context=await characterContext(db,characterId),old=await db.prepare('SELECT armor_id FROM character_equipped_armors WHERE character_id=? AND armor_slot=?').bind(characterId,slot).first();if(!old)throw new HttpError(404,'NOT_FOUND','防具が装備されていません。');
  await db.batch([db.prepare('DELETE FROM character_equipped_armors WHERE character_id=? AND armor_slot=?').bind(characterId,slot),db.prepare('INSERT INTO adventure_armors(adventure_id,armor_id,quantity) VALUES(?,?,1) ON CONFLICT(adventure_id,armor_id) DO UPDATE SET quantity=quantity+1').bind(context.adventureId,numberValue(old.armor_id))]);return json(await getCharacterDetail(db,characterId));
}

async function equipTalisman(db:D1Database,request:Request,characterId:number){
  const input=await body(request),itemId=integer(input,'itemId',1),context=await characterContext(db,characterId),count=await db.prepare('SELECT COUNT(*) count FROM character_equipped_talismans WHERE character_id=?').bind(characterId).first(),max=1+numberValue(context.row.talisman_pouches);if(numberValue(count?.count)>=max)throw new HttpError(400,'LIMIT_EXCEEDED','タリスマンの装備数が上限に達しています。');
  const results=await db.batch([db.prepare(`INSERT INTO character_equipped_talismans(character_id,talisman_id,position) SELECT ?,?,COALESCE((SELECT MAX(position)+1 FROM character_equipped_talismans WHERE character_id=?),1) WHERE EXISTS(SELECT 1 FROM adventure_talismans WHERE adventure_id=? AND talisman_id=? AND quantity>0)`).bind(characterId,itemId,characterId,context.adventureId,itemId),db.prepare('DELETE FROM adventure_talismans WHERE adventure_id=? AND talisman_id=? AND quantity=1').bind(context.adventureId,itemId),db.prepare('UPDATE adventure_talismans SET quantity=quantity-1 WHERE adventure_id=? AND talisman_id=? AND quantity>1').bind(context.adventureId,itemId)]);if(Number(results[0].meta?.changes??0)!==1)throw new HttpError(409,'OUT_OF_STOCK','冒険の所持品に対象のタリスマンがありません。');return json(await getCharacterDetail(db,characterId));
}

async function unequipTalisman(db:D1Database,characterId:number,slotId:number){
  const context=await characterContext(db,characterId),slot=await db.prepare('SELECT talisman_id FROM character_equipped_talismans WHERE id=? AND character_id=?').bind(slotId,characterId).first();if(!slot)throw new HttpError(404,'NOT_FOUND','タリスマンが見つかりません。');await db.batch([db.prepare('DELETE FROM character_equipped_talismans WHERE id=? AND character_id=?').bind(slotId,characterId),db.prepare('INSERT INTO adventure_talismans(adventure_id,talisman_id,quantity) VALUES(?,?,1) ON CONFLICT(adventure_id,talisman_id) DO UPDATE SET quantity=quantity+1').bind(context.adventureId,numberValue(slot.talisman_id))]);return json(await getCharacterDetail(db,characterId));
}

async function learnSkillSet(db:D1Database,request:Request,characterId:number){
  const input=await body(request),setId=integer(input,'itemId',1),context=await characterContext(db,characterId);if(await db.prepare('SELECT 1 ok FROM character_learned_skill_sets WHERE character_id=? AND skill_set_id=?').bind(characterId,setId).first())throw new HttpError(409,'ALREADY_EXISTS','このスキルセットは習得済みです。');
  const results=await db.batch([db.prepare(`INSERT INTO character_learned_skill_sets(character_id,skill_set_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM adventure_skill_sets WHERE adventure_id=? AND skill_set_id=? AND quantity>0)`).bind(characterId,setId,context.adventureId,setId),db.prepare('DELETE FROM adventure_skill_sets WHERE adventure_id=? AND skill_set_id=? AND quantity=1').bind(context.adventureId,setId),db.prepare('UPDATE adventure_skill_sets SET quantity=quantity-1 WHERE adventure_id=? AND skill_set_id=? AND quantity>1').bind(context.adventureId,setId)]);if(Number(results[0].meta?.changes??0)!==1)throw new HttpError(409,'OUT_OF_STOCK','冒険の所持品に対象のスキルセットがありません。');return json(await getCharacterDetail(db,characterId));
}

async function learnSkill(db:D1Database,request:Request,characterId:number){
  const input=await body(request),skillId=integer(input,'itemId',1),context=await characterContext(db,characterId),count=await db.prepare('SELECT COUNT(*) count FROM character_equipped_skills WHERE character_id=?').bind(characterId).first(),max=2+numberValue(context.row.memory_stones);if(numberValue(count?.count)>=max)throw new HttpError(400,'LIMIT_EXCEEDED','スキルの習得数が上限に達しています。');
  const allowed=await db.prepare(`SELECT 1 ok FROM character_learned_skill_sets ls JOIN skill_set_members m ON m.skill_set_id=ls.skill_set_id WHERE ls.character_id=? AND m.skill_id=? LIMIT 1`).bind(characterId,skillId).first();if(!allowed)throw new HttpError(400,'INVALID_REFERENCE','習得済みスキルセットに含まれないスキルです。');if(await db.prepare('SELECT 1 ok FROM character_equipped_skills WHERE character_id=? AND skill_id=?').bind(characterId,skillId).first())throw new HttpError(409,'ALREADY_EXISTS','このスキルは習得済みです。');await db.prepare(`INSERT INTO character_equipped_skills(character_id,skill_id,position,rank) VALUES(?,?,COALESCE((SELECT MAX(position)+1 FROM character_equipped_skills WHERE character_id=?),1),1)`).bind(characterId,skillId,characterId).run();return json(await getCharacterDetail(db,characterId));
}

async function changeLearnedSkill(db:D1Database,request:Request,characterId:number,rowId:number){
  const current=await db.prepare('SELECT skill_id,rank FROM character_equipped_skills WHERE id=? AND character_id=?').bind(rowId,characterId).first();if(!current)throw new HttpError(404,'NOT_FOUND','スキルが見つかりません。');if(request.method==='DELETE'){await db.prepare('DELETE FROM character_equipped_skills WHERE id=? AND character_id=?').bind(rowId,characterId).run();return json(await getCharacterDetail(db,characterId));}
  if(request.method!=='PUT')throw new HttpError(405,'METHOD_NOT_ALLOWED','未対応の操作です。');const next=numberValue(current.rank)+1,effect=await db.prepare('SELECT effect FROM skill_rank_effects WHERE skill_id=? AND rank=?').bind(numberValue(current.skill_id),next).first();if(next>3||!stringValue(effect?.effect).trim())throw new HttpError(400,'MAX_RANK','これ以上ランクアップできません。');await db.prepare('UPDATE character_equipped_skills SET rank=? WHERE id=? AND character_id=?').bind(next,rowId,characterId).run();return json(await getCharacterDetail(db,characterId));
}

async function changeWeaponReinforcement(db:D1Database,request:Request,characterId:number,slotId:number){
  const input=await body(request),reinforcementLevel=integer(input,'reinforcementLevel');
  const result=await db.prepare('UPDATE character_weapon_slots SET reinforcement_level=? WHERE id=? AND character_id=?').bind(reinforcementLevel,slotId,characterId).run();
  if(Number(result.meta?.changes??0)!==1)throw new HttpError(404,'NOT_FOUND','武器が見つかりません。');
  return json(await getCharacterDetail(db,characterId));
}

async function characterAction(db:D1Database,request:Request,path:string){
  let match=path.match(/^\/api\/characters\/(\d+)\/(weapons|shields)$/);if(match&&request.method==='POST')return equipWeaponOrShield(db,request,Number(match[1]),match[2]==='weapons'?'weapon':'shield');
  match=path.match(/^\/api\/characters\/(\d+)\/(weapons|shields)\/(\d+)$/);if(match&&request.method==='DELETE')return unequipWeaponOrShield(db,Number(match[1]),Number(match[3]),match[2]==='weapons'?'weapon':'shield');if(match&&request.method==='PUT'&&match[2]==='weapons')return changeWeaponReinforcement(db,request,Number(match[1]),Number(match[3]));
  match=path.match(/^\/api\/characters\/(\d+)\/armors\/(head|body)$/);if(match&&request.method==='PUT')return changeArmor(db,request,Number(match[1]),match[2]);if(match&&request.method==='DELETE')return removeArmor(db,Number(match[1]),match[2]);
  match=path.match(/^\/api\/characters\/(\d+)\/talismans$/);if(match&&request.method==='POST')return equipTalisman(db,request,Number(match[1]));
  match=path.match(/^\/api\/characters\/(\d+)\/talismans\/(\d+)$/);if(match&&request.method==='DELETE')return unequipTalisman(db,Number(match[1]),Number(match[2]));
  match=path.match(/^\/api\/characters\/(\d+)\/skill-sets$/);if(match&&request.method==='POST')return learnSkillSet(db,request,Number(match[1]));
  match=path.match(/^\/api\/characters\/(\d+)\/skills$/);if(match&&request.method==='POST')return learnSkill(db,request,Number(match[1]));
  match=path.match(/^\/api\/characters\/(\d+)\/skills\/(\d+)$/);if(match)return changeLearnedSkill(db,request,Number(match[1]),Number(match[2]));
  throw new HttpError(404,'NOT_FOUND','APIが見つかりません。');
}

async function options(db:D1Database){
  const queries=[['skills','SELECT id,name FROM skills ORDER BY name'],['armorSets','SELECT id,name FROM armor_sets ORDER BY name'],['weaponCategories','SELECT id,name FROM weapon_categories ORDER BY name'],['shieldCategories','SELECT id,name FROM shield_categories ORDER BY name'],['skillSets','SELECT id,name FROM skill_sets ORDER BY name'],['armors','SELECT id,name,armor_slot slot FROM armors ORDER BY name'],['weapons','SELECT id,name FROM weapons ORDER BY name'],['shields','SELECT id,name FROM shields ORDER BY name']] as const;
  const values=await Promise.all(queries.map(async([key,sql])=>[key,(await db.prepare(sql).all()).results] as const));return json(Object.fromEntries(values));
}

async function armorSetList(db:D1Database){
  const rows=(await db.prepare(`SELECT s.id,s.name,s.series_effect,COUNT(DISTINCT a.id) armor_count,COUNT(DISTINCT ask.skill_id) skill_count
    FROM armor_sets s
    LEFT JOIN armors a ON a.armor_set_id=s.id
    LEFT JOIN armor_set_skills ask ON ask.armor_set_id=s.id
    GROUP BY s.id,s.name,s.series_effect
    ORDER BY s.id`).all()).results;
  return json(rows.map(row=>({id:Number(row.id),name:String(row.name),seriesEffect:String(row.series_effect??''),armorCount:Number(row.armor_count),skillCount:Number(row.skill_count)})));
}

async function deleteArmorSet(db:D1Database,path:string){
  const id=idFrom(path,/^\/api\/admin\/armor-sets\/(\d+)$/);
  if(!await db.prepare('SELECT id FROM armor_sets WHERE id=?').bind(id).first())throw new HttpError(404,'NOT_FOUND','防具セットが見つかりません。');
  await db.prepare('DELETE FROM armor_sets WHERE id=?').bind(id).run();
  return json({ok:true});
}

async function armorList(db:D1Database){
  const [armors,skills]=await Promise.all([
    db.prepare(`SELECT a.*,s.name armor_set_name FROM armors a LEFT JOIN armor_sets s ON s.id=a.armor_set_id ORDER BY a.id`).all(),
    db.prepare(`SELECT link.armor_id,s.id,s.name FROM armor_skills link JOIN skills s ON s.id=link.skill_id ORDER BY s.name`).all()
  ]);
  return json(armors.results.map(armor=>({id:Number(armor.id),name:String(armor.name),slot:String(armor.armor_slot),weight:Number(armor.weight),physicalCut:Number(armor.physical_cut),phenomenonCut:Number(armor.phenomenon_cut),poise:Number(armor.poise),armorSet:armor.armor_set_id===null?null:{id:Number(armor.armor_set_id),name:String(armor.armor_set_name)},skills:skills.results.filter(row=>row.armor_id===armor.id).map(row=>({id:Number(row.id),name:String(row.name)}))})));
}

async function armorById(db:D1Database,request:Request,path:string){
  const id=idFrom(path,/^\/api\/admin\/armors\/(\d+)$/);
  if(!await db.prepare('SELECT id FROM armors WHERE id=?').bind(id).first())throw new HttpError(404,'NOT_FOUND','防具が見つかりません。');
  if(request.method==='DELETE'){
    const tables=['origin_initial_armors','character_equipped_armors','adventure_armors','armor_skills'];
    await db.batch([...tables.map(table=>db.prepare(`DELETE FROM ${table} WHERE armor_id=?`).bind(id)),db.prepare('DELETE FROM armors WHERE id=?').bind(id)]);
    return json({ok:true});
  }
  if(request.method!=='PUT')throw new HttpError(405,'METHOD_NOT_ALLOWED','未対応の操作です。');
  const input=await body(request);const name=text(input,'name');const slot=text(input,'slot');if(!['HEAD','BODY'].includes(slot))throw new HttpError(400,'VALIDATION_ERROR','防具部位が不正です。');
  const armorSetId=input.armorSetId===null||input.armorSetId===''||input.armorSetId===undefined?null:integer(input,'armorSetId',1);const skillIds=ids(input,'skillIds');
  await assertReferences(db,[...(armorSetId?[['armor_sets',armorSetId] as [string,number]]:[]),...skillIds.map(skillId=>['skills',skillId] as [string,number])]);
  const statements=[db.prepare('UPDATE armors SET armor_set_id=?,name=?,armor_slot=?,weight=?,physical_cut=?,phenomenon_cut=?,poise=? WHERE id=?').bind(armorSetId,name,slot,integer(input,'weight'),signedInteger(input,'physicalCut'),signedInteger(input,'phenomenonCut'),signedInteger(input,'poise'),id),db.prepare('DELETE FROM armor_skills WHERE armor_id=?').bind(id)];
  skillIds.forEach(skillId=>statements.push(db.prepare('INSERT INTO armor_skills(armor_id,skill_id) VALUES(?,?)').bind(id,skillId)));
  await db.batch(statements);return json({ok:true});
}

async function skillList(db:D1Database){
  const [skills,effects,weaponCategories,shieldCategories]=await Promise.all([
    db.prepare('SELECT * FROM skills ORDER BY id').all(),
    db.prepare('SELECT skill_id,rank,effect FROM skill_rank_effects ORDER BY rank').all(),
    db.prepare(`SELECT link.skill_id,c.id,c.name FROM skill_weapon_categories link JOIN weapon_categories c ON c.id=link.weapon_category_id ORDER BY c.id`).all(),
    db.prepare(`SELECT link.skill_id,c.id,c.name FROM skill_shield_categories link JOIN shield_categories c ON c.id=link.shield_category_id ORDER BY c.id`).all()
  ]);
  return json(skills.results.map(skill=>({id:Number(skill.id),name:String(skill.name),classification:String(skill.classification),timing:String(skill.timing),target:String(skill.target),cost:String(skill.cost),maxUses:skill.max_uses===null?null:Number(skill.max_uses),rankEffects:[1,2,3].map(rank=>String(effects.results.find(row=>row.skill_id===skill.id&&row.rank===rank)?.effect??'')),weaponCategories:weaponCategories.results.filter(row=>row.skill_id===skill.id).map(row=>({id:Number(row.id),name:String(row.name)})),shieldCategories:shieldCategories.results.filter(row=>row.skill_id===skill.id).map(row=>({id:Number(row.id),name:String(row.name)}))})));
}

async function talismanList(db:D1Database){
  const rows=await db.prepare('SELECT id,name,weight,effect FROM talismans ORDER BY id').all();
  return json(rows.results.map(row=>({id:Number(row.id),name:String(row.name),weight:Number(row.weight),effect:String(row.effect)})));
}

async function talismanById(db:D1Database,request:Request,path:string){
  const id=idFrom(path,/^\/api\/admin\/talismans\/(\d+)$/);
  if(!await db.prepare('SELECT id FROM talismans WHERE id=?').bind(id).first())throw new HttpError(404,'NOT_FOUND','タリスマンが見つかりません。');
  if(request.method==='DELETE'){
    await db.batch([
      db.prepare('DELETE FROM character_equipped_talismans WHERE talisman_id=?').bind(id),
      db.prepare('DELETE FROM adventure_talismans WHERE talisman_id=?').bind(id),
      db.prepare('DELETE FROM talismans WHERE id=?').bind(id)
    ]);
    return json({ok:true});
  }
  if(request.method!=='PUT')throw new HttpError(405,'METHOD_NOT_ALLOWED','未対応の操作です。');
  const input=await body(request);
  await db.prepare('UPDATE talismans SET name=?,weight=?,effect=? WHERE id=?').bind(text(input,'name'),signedInteger(input,'weight'),text(input,'effect'),id).run();
  return json({ok:true});
}

async function skillById(db:D1Database,request:Request,path:string){
  const id=idFrom(path,/^\/api\/admin\/skills\/(\d+)$/);
  if(!await db.prepare('SELECT id FROM skills WHERE id=?').bind(id).first())throw new HttpError(404,'NOT_FOUND','スキルが見つかりません。');
  if(request.method==='DELETE'){
    const tables=['skill_set_members','armor_skills','armor_set_skills','weapon_skills','weapon_category_skills','shield_skills','skill_weapon_categories','skill_shield_categories','character_equipped_skills','skill_rank_effects'];
    await db.batch([...tables.map(table=>db.prepare(`DELETE FROM ${table} WHERE skill_id=?`).bind(id)),db.prepare('DELETE FROM skills WHERE id=?').bind(id)]);
    return json({ok:true});
  }
  if(request.method!=='PUT')throw new HttpError(405,'METHOD_NOT_ALLOWED','未対応の操作です。');
  const input=await body(request);const name=text(input,'name');const timing=text(input,'timing').toUpperCase();if(!['AC','RE','TRIGGER','PASSIVE'].includes(timing))throw new HttpError(400,'VALIDATION_ERROR','タイミングが不正です。');
  const max=input.maxUses===null||input.maxUses===''?null:integer(input,'maxUses');const categoryIds=ids(input,'categoryIds');const shieldCategoryIds=ids(input,'shieldCategoryIds');
  await assertReferences(db,[...categoryIds.map(categoryId=>['weapon_categories',categoryId] as [string,number]),...shieldCategoryIds.map(categoryId=>['shield_categories',categoryId] as [string,number])]);
  const rankEffects=Array.isArray(input.rankEffects)?input.rankEffects:[];if(rankEffects.length!==3)throw new HttpError(400,'VALIDATION_ERROR','ランク効果は3件必要です。');
  const statements=[db.prepare('UPDATE skills SET name=?,classification=?,timing=?,target=?,cost=?,max_uses=? WHERE id=?').bind(name,text(input,'classification'),timing,text(input,'target'),text(input,'cost'),max,id),db.prepare('DELETE FROM skill_rank_effects WHERE skill_id=?').bind(id),db.prepare('DELETE FROM skill_weapon_categories WHERE skill_id=?').bind(id),db.prepare('DELETE FROM skill_shield_categories WHERE skill_id=?').bind(id)];
  rankEffects.forEach((effect,rank)=>statements.push(db.prepare('INSERT INTO skill_rank_effects(skill_id,rank,effect) VALUES(?,?,?)').bind(id,rank+1,String(effect).trim())));
  categoryIds.forEach(categoryId=>statements.push(db.prepare('INSERT INTO skill_weapon_categories(skill_id,weapon_category_id) VALUES(?,?)').bind(id,categoryId)));
  shieldCategoryIds.forEach(categoryId=>statements.push(db.prepare('INSERT INTO skill_shield_categories(skill_id,shield_category_id) VALUES(?,?)').bind(id,categoryId)));
  await db.batch(statements);return json({ok:true});
}

function newWeaponCategory(input:Record<string,unknown>){
  const one=Array.isArray(input.oneHandDamage)?input.oneHandDamage:[];const two=Array.isArray(input.twoHandDamage)?input.twoHandDamage:[];
  if(one.length!==5||two.length!==5||[...one,...two].some(v=>typeof v!=='string'))throw new HttpError(400,'VALIDATION_ERROR','武器カテゴリのダメージ欄が不正です。');
  return [text(input,'name'),text(input,'size'),integer(input,'attackCost'),...one.map(v=>String(v).trim()),...two.map(v=>String(v).trim()),integer(input,'guardCost'),guardCut(input,'twoHandPhysicalGuard',true),guardCut(input,'twoHandPhenomenonGuard',true)];
}
const weaponCategoryInsert='INSERT INTO weapon_categories(name,size,attack_cost,one_hand_damage_1,one_hand_damage_2,one_hand_damage_3,one_hand_damage_4,one_hand_damage_5,two_hand_damage_1,two_hand_damage_2,two_hand_damage_3,two_hand_damage_4,two_hand_damage_5,guard_cost,two_hand_physical_guard,two_hand_phenomenon_guard) VALUES('+placeholders(16)+')';

async function adminCreate(db:D1Database,request:Request,kind:string){
  const input=await body(request);const statements:D1Statement[]=[];
  if(kind==='special-items'){
    statements.push(db.prepare('INSERT INTO special_items(name) VALUES(?)').bind(text(input,'name')));
  } else if(kind==='talismans'){
    statements.push(db.prepare('INSERT INTO talismans(name,weight,effect) VALUES(?,?,?)').bind(text(input,'name'),signedInteger(input,'weight'),text(input,'effect')));
  } else if(kind==='episodes'){
    const episodeType=text(input,'episodeType').toUpperCase();if(!['MAIN','SIDE'].includes(episodeType))throw new HttpError(400,'VALIDATION_ERROR','エピソード種別が不正です。');
    const episodeNumber=integer(input,'episodeNumber');const validNumber=episodeType==='MAIN'?episodeNumber<=11:episodeNumber>=1&&episodeNumber<=10;if(!validNumber)throw new HttpError(400,'VALIDATION_ERROR',episodeType==='MAIN'?'メインEP番号は0～11です。':'外伝EP番号は1～10です。');
    const displayCode=episodeType==='MAIN'?`EP${String(episodeNumber).padStart(2,'0')}`:`外伝EP${String(episodeNumber).padStart(2,'0')}`;
    statements.push(db.prepare('INSERT INTO episodes(name,episode_type,episode_number,display_code,malice_level) VALUES(?,?,?,?,?)').bind(text(input,'name'),episodeType,episodeNumber,displayCode,integer(input,'maliceLevel')));
  } else if(kind==='origins'){
    const initial=asObject(input.initial);const name=text(input,'name');const skillSetIds=ids(input,'skillSetIds');const weaponIds=orderedIds(input,'weaponIds');const shieldIds=ids(input,'shieldIds');
    const headArmorId=input.headArmorId===null||input.headArmorId===''||input.headArmorId===undefined?null:integer(input,'headArmorId',1);const bodyArmorId=input.bodyArmorId===null||input.bodyArmorId===''||input.bodyArmorId===undefined?null:integer(input,'bodyArmorId',1);
    await assertReferences(db,[...skillSetIds.map(id=>['skill_sets',id] as [string,number]),...weaponIds.map(id=>['weapons',id] as [string,number]),...shieldIds.map(id=>['shields',id] as [string,number]),...(headArmorId?[['armors',headArmorId] as [string,number]]:[]),...(bodyArmorId?[['armors',bodyArmorId] as [string,number]]:[])]);
    for(const [id,slot] of [[headArmorId,'HEAD'],[bodyArmorId,'BODY']] as const){if(id){const armor=await db.prepare('SELECT armor_slot FROM armors WHERE id=?').bind(id).first();if(armor?.armor_slot!==slot)throw new HttpError(400,'VALIDATION_ERROR',`${slot==='HEAD'?'頭':'胴体'}防具の部位が不正です。`);}}
    statements.push(db.prepare(`INSERT INTO origins(name,initial_level,${abilityKeys.map(k=>`initial_${k}`).join(',')}) VALUES(${placeholders(10)})`).bind(name,integer(input,'initialLevel'),...abilityKeys.map(k=>integer(initial,k))));
    for(const id of skillSetIds)statements.push(db.prepare('INSERT INTO origin_initial_skill_sets(origin_id,skill_set_id) VALUES((SELECT id FROM origins WHERE name=?),?)').bind(name,id));
    weaponIds.forEach((id,i)=>statements.push(db.prepare('INSERT INTO origin_initial_weapons(origin_id,weapon_id,position) VALUES((SELECT id FROM origins WHERE name=?),?,?)').bind(name,id,i+1)));
    shieldIds.forEach((id,i)=>statements.push(db.prepare('INSERT INTO origin_initial_shields(origin_id,shield_id,position) VALUES((SELECT id FROM origins WHERE name=?),?,?)').bind(name,id,i+1)));
    if(headArmorId)statements.push(db.prepare('INSERT INTO origin_initial_armors(origin_id,armor_slot,armor_id) VALUES((SELECT id FROM origins WHERE name=?),?,?)').bind(name,'HEAD',headArmorId));
    if(bodyArmorId)statements.push(db.prepare('INSERT INTO origin_initial_armors(origin_id,armor_slot,armor_id) VALUES((SELECT id FROM origins WHERE name=?),?,?)').bind(name,'BODY',bodyArmorId));
  } else if(kind==='armor-sets'){
    const name=text(input,'name');const skillIds=ids(input,'skillIds');
    await assertReferences(db,skillIds.map(id=>['skills',id]));
    statements.push(db.prepare('INSERT INTO armor_sets(name,series_effect) VALUES(?,?)').bind(name,text(input,'seriesEffect',true)));
    skillIds.forEach(id=>statements.push(db.prepare('INSERT INTO armor_set_skills(armor_set_id,skill_id) VALUES((SELECT id FROM armor_sets WHERE name=?),?)').bind(name,id)));
  } else if(kind==='armors'){
    const name=text(input,'name');const slot=text(input,'slot');if(!['HEAD','BODY'].includes(slot))throw new HttpError(400,'VALIDATION_ERROR','防具部位が不正です。');
    const newSet=input.newArmorSet?asObject(input.newArmorSet):null;const setId=input.armorSetId?integer(input,'armorSetId',1):null;const skillIds=ids(input,'skillIds');
    await assertReferences(db,[...(setId?[['armor_sets',setId] as [string,number]]:[]),...skillIds.map(id=>['skills',id] as [string,number])]);
    if(newSet)statements.push(db.prepare('INSERT INTO armor_sets(name,series_effect) VALUES(?,?)').bind(text(newSet,'name'),text(newSet,'seriesEffect',true)));
    const setExpr=newSet?'(SELECT id FROM armor_sets WHERE name=?)':'?';const values=newSet?[text(newSet,'name')]:[setId];
    statements.push(db.prepare(`INSERT INTO armors(armor_set_id,name,armor_slot,weight,physical_cut,phenomenon_cut,poise) VALUES(${setExpr},?,?,?,?,?,?)`).bind(...values,name,slot,integer(input,'weight'),signedInteger(input,'physicalCut'),signedInteger(input,'phenomenonCut'),signedInteger(input,'poise')));
    skillIds.forEach(id=>statements.push(db.prepare('INSERT INTO armor_skills(armor_id,skill_id) VALUES((SELECT id FROM armors WHERE name=?),?)').bind(name,id)));
  } else if(kind==='weapons'){
    const name=text(input,'name');const categoryId=integer(input,'categoryId',1);const skillIds=ids(input,'skillIds');
    await assertReferences(db,[['weapon_categories',categoryId],...skillIds.map(id=>['skills',id] as [string,number])]);
    const req=asObject(input.requirements);
    statements.push(db.prepare('INSERT INTO weapons(weapon_category_id,name,weight,power_modifier,required_strength,required_dexterity,required_intelligence,required_faith,required_arcane) VALUES(?,?,?,?,?,?,?,?,?)').bind(categoryId,name,integer(input,'weight'),text(input,'powerModifier'),...(['strength','dexterity','intelligence','faith','arcane'] as AbilityKey[]).map(k=>integer(req,k))));
    skillIds.forEach(id=>statements.push(db.prepare('INSERT INTO weapon_skills(weapon_id,skill_id) VALUES((SELECT id FROM weapons WHERE name=?),?)').bind(name,id)));
  } else if(kind==='weapon-categories'){
    const name=text(input,'name');const skillIds=ids(input,'skillIds');
    await assertReferences(db,skillIds.map(id=>['skills',id]));
    statements.push(db.prepare(weaponCategoryInsert).bind(...newWeaponCategory(input)));
    skillIds.forEach(id=>statements.push(db.prepare('INSERT INTO weapon_category_skills(weapon_category_id,skill_id) VALUES((SELECT id FROM weapon_categories WHERE name=?),?)').bind(name,id)));
  } else if(kind==='shields'){
    const name=text(input,'name');const categoryId=integer(input,'categoryId',1);const skillIds=ids(input,'skillIds');
    await assertReferences(db,[['shield_categories',categoryId],...skillIds.map(id=>['skills',id] as [string,number])]);
    const req=asObject(input.requirements);
    statements.push(db.prepare('INSERT INTO shields(shield_category_id,name,weight,guard_cost,physical_guard,phenomenon_guard,required_strength,required_dexterity,required_intelligence,required_faith,required_arcane) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(categoryId,name,integer(input,'weight'),integer(input,'guardCost'),guardCut(input,'physicalGuard'),guardCut(input,'phenomenonGuard'),...(['strength','dexterity','intelligence','faith','arcane'] as AbilityKey[]).map(k=>integer(req,k))));
    skillIds.forEach(id=>statements.push(db.prepare('INSERT INTO shield_skills(shield_id,skill_id) VALUES((SELECT id FROM shields WHERE name=?),?)').bind(name,id)));
  } else if(kind==='shield-categories'){
    statements.push(db.prepare('INSERT INTO shield_categories(name,size) VALUES(?,?)').bind(text(input,'name'),text(input,'size')));
  } else if(kind==='skill-sets'){
    const name=text(input,'name');const skillIds=ids(input,'skillIds');
    await assertReferences(db,skillIds.map(id=>['skills',id]));
    statements.push(db.prepare('INSERT INTO skill_sets(name,notes) VALUES(?,?)').bind(name,text(input,'notes',true)));
    skillIds.forEach((id,i)=>statements.push(db.prepare('INSERT INTO skill_set_members(skill_set_id,skill_id,position) VALUES((SELECT id FROM skill_sets WHERE name=?),?,?)').bind(name,id,i+1)));
  } else if(kind==='skills'){
    const name=text(input,'name');const timing=text(input,'timing').toUpperCase();if(!['AC','RE','TRIGGER','PASSIVE'].includes(timing))throw new HttpError(400,'VALIDATION_ERROR','タイミングが不正です。');
    const max=input.maxUses===null||input.maxUses===''?null:integer(input,'maxUses');const categoryIds=ids(input,'categoryIds');const shieldCategoryIds=ids(input,'shieldCategoryIds');
    await assertReferences(db,[...categoryIds.map(id=>['weapon_categories',id] as [string,number]),...shieldCategoryIds.map(id=>['shield_categories',id] as [string,number])]);
    statements.push(db.prepare('INSERT INTO skills(name,classification,timing,target,cost,max_uses) VALUES(?,?,?,?,?,?)').bind(name,text(input,'classification'),timing,text(input,'target'),text(input,'cost'),max));
    const effects=Array.isArray(input.rankEffects)?input.rankEffects:[];if(effects.length!==3)throw new HttpError(400,'VALIDATION_ERROR','ランク効果は3件必要です。');
    effects.forEach((effect,i)=>statements.push(db.prepare('INSERT INTO skill_rank_effects(skill_id,rank,effect) VALUES((SELECT id FROM skills WHERE name=?),?,?)').bind(name,i+1,String(effect).trim())));
    categoryIds.forEach(id=>statements.push(db.prepare('INSERT INTO skill_weapon_categories(skill_id,weapon_category_id) VALUES((SELECT id FROM skills WHERE name=?),?)').bind(name,id)));
    shieldCategoryIds.forEach(id=>statements.push(db.prepare('INSERT INTO skill_shield_categories(skill_id,shield_category_id) VALUES((SELECT id FROM skills WHERE name=?),?)').bind(name,id)));
  } else if(kind==='spirit-ashes'){
    const name=text(input,'name');const main=asObject(input.mainAction);const sub=asObject(input.subAction);
    statements.push(db.prepare(`INSERT INTO spirit_ashes(name,party_slot_cost,summon_cost,summon_count,level,movement_modifier,perception_modifier,physical_cut,phenomenon_cut,guard_count,guard_cut_rate,evasion_count,special_ability,main_action_name,main_action_target,main_action_damage,sub_action_name,sub_action_target,sub_action_damage,action_special_effect) VALUES(${placeholders(20)})`).bind(name,integer(input,'partySlotCost'),text(input,'summonCost'),integer(input,'summonCount'),integer(input,'level'),signedInteger(input,'movementModifier'),signedInteger(input,'perceptionModifier'),signedInteger(input,'physicalCut'),signedInteger(input,'phenomenonCut'),integer(input,'guardCount'),integer(input,'guardCutRate'),integer(input,'evasionCount'),text(input,'specialAbility',true),text(main,'name'),text(main,'target'),text(main,'damage'),text(sub,'name'),text(sub,'target'),text(sub,'damage'),text(input,'actionSpecialEffect',true)));
    const effects=Array.isArray(input.upgradeEffects)?input.upgradeEffects:[];if(effects.length!==5)throw new HttpError(400,'VALIDATION_ERROR','強化効果は5件必要です。');effects.forEach((effect,i)=>statements.push(db.prepare('INSERT INTO spirit_ash_upgrade_effects(spirit_ash_id,upgrade_level,effect) VALUES((SELECT id FROM spirit_ashes WHERE name=?),?,?)').bind(name,i+1,String(effect).trim())));
  } else throw new HttpError(404,'NOT_FOUND','APIが見つかりません。');
  await db.batch(statements);return json({ok:true},201);
}

async function route(request:Request,env:Env){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/adventures'&&['GET','POST'].includes(request.method))return adventures(env.DB,request);
  if(/^\/api\/adventures\/\d+\/contents$/.test(path)&&request.method==='PUT')return adventureContents(env.DB,request,path);
  if(/^\/api\/adventures\/\d+\/episodes\/\d+$/.test(path)&&request.method==='PUT')return adventureEpisodeProgress(env.DB,request,path);
  if(/^\/api\/adventures\/\d+$/.test(path))return adventureById(env.DB,request,path);
  if(path==='/api/origins'&&request.method==='GET')return origins(env.DB);
  if(path==='/api/characters'&&['GET','POST'].includes(request.method))return characters(env.DB,request,url);
  if(/^\/api\/characters\/\d+\/.+/.test(path))return characterAction(env.DB,request,path);
  if(/^\/api\/characters\/\d+$/.test(path))return characterById(env.DB,request,path);
  if(path==='/api/admin/options'&&request.method==='GET')return options(env.DB);
  if(path==='/api/admin/armors'&&request.method==='GET')return armorList(env.DB);
  if(/^\/api\/admin\/armors\/\d+$/.test(path))return armorById(env.DB,request,path);
  if(path==='/api/admin/skills'&&request.method==='GET')return skillList(env.DB);
  if(/^\/api\/admin\/skills\/\d+$/.test(path))return skillById(env.DB,request,path);
  if(path==='/api/admin/talismans'&&request.method==='GET')return talismanList(env.DB);
  if(/^\/api\/admin\/talismans\/\d+$/.test(path))return talismanById(env.DB,request,path);
  if(path==='/api/admin/armor-sets'&&request.method==='GET')return armorSetList(env.DB);
  if(/^\/api\/admin\/armor-sets\/\d+$/.test(path)&&request.method==='DELETE')return deleteArmorSet(env.DB,path);
  const admin=path.match(/^\/api\/admin\/(episodes|special-items|origins|armors|armor-sets|weapons|weapon-categories|shields|shield-categories|talismans|skills|skill-sets|spirit-ashes)$/);if(admin&&request.method==='POST')return adminCreate(env.DB,request,admin[1]);
  throw new HttpError(404,'NOT_FOUND','APIが見つかりません。');
}

export default {async fetch(request:Request,env:Env):Promise<Response>{
  const path=new URL(request.url).pathname;if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
  try{return await route(request,env);}catch(error){console.error(JSON.stringify({event:'api_error',path,status:error instanceof HttpError?error.status:500,message:error instanceof Error?error.message:String(error)}));
    if(error instanceof HttpError)return json({error:{code:error.code,message:error.message}},error.status);
    const message=error instanceof Error&&/UNIQUE constraint failed/.test(error.message)?'同じ名前のデータが既に登録されています。':'サーバーでエラーが発生しました。';const status=message.startsWith('同じ')?409:500;return json({error:{code:status===409?'CONFLICT':'INTERNAL_ERROR',message}},status);
  }} };
