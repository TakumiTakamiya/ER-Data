import { abilityKeys, type AbilityKey } from '../src/lib/types';

interface D1Result<T = Record<string, unknown>> { results: T[]; success: boolean; meta?: { last_row_id?: number } }
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
  o.initial_dexterity, o.initial_intelligence, o.initial_faith, o.initial_arcane
  FROM characters c JOIN adventures a ON a.id=c.adventure_id JOIN origins o ON o.id=c.origin_id`;

function mapCharacter(row: Record<string, unknown>) {
  const abilities = Object.fromEntries(abilityKeys.map((key) => {
    const initial = Number(row[`initial_${key}`]); const growth = Number(row[`${key}_growth`]); const bonus = Number(row[`${key}_bonus`]);
    return [key, { initial, growth, bonus, total: initial + growth + bonus }];
  }));
  return { id: row.id, name: row.name, level: row.level, adventureId: row.adventure_id, adventureName: row.adventure_name,
    originId: row.origin_id, originName: row.origin_name, runes: row.runes, materialPoints: row.material_points, abilities };
}

function characterValues(input: Record<string, unknown>) {
  const growth = asObject(input.growth); const bonus = asObject(input.bonus);
  return [integer(input, 'adventureId', 1), integer(input, 'originId', 1), text(input, 'name'), integer(input, 'level'), integer(input, 'runes'), integer(input, 'materialPoints'),
    ...abilityKeys.map((key) => integer(growth, key)), ...abilityKeys.map((key) => signedInteger(bonus, key))];
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
  const creationInput={...input,adventureId,originId,level:Number(origin!.initial_level),runes:0,materialPoints:0,growth:Object.fromEntries(abilityKeys.map(key=>[key,0])),bonus:Object.fromEntries(abilityKeys.map(key=>[key,0]))};
  const values=characterValues(creationInput);
  const cols=['adventure_id','origin_id','name','level','runes','material_points',...abilityKeys.map(k=>`${k}_growth`),...abilityKeys.map(k=>`${k}_bonus`)];
  const result=await db.prepare(`INSERT INTO characters(${cols.join(',')}) VALUES(${placeholders(cols.length)})`).bind(...values).run();
  return json(mapCharacter((await db.prepare(`${characterSelect} WHERE c.id=?`).bind(result.meta?.last_row_id).first())!),201);
}

async function characterById(db:D1Database,request:Request,path:string) {
  const id=idFrom(path,/^\/api\/characters\/(\d+)$/);
  if(request.method==='GET'){const row=await db.prepare(`${characterSelect} WHERE c.id=?`).bind(id).first();if(!row)throw new HttpError(404,'NOT_FOUND','キャラクターが見つかりません。');return json(mapCharacter(row));}
  if(request.method!=='PUT')throw new HttpError(405,'METHOD_NOT_ALLOWED','未対応の操作です。');
  const input=await body(request);const values=characterValues(input);await assertReferences(db,[['adventures',values[0] as number],['origins',values[1] as number]]);
  const cols=['adventure_id','origin_id','name','level','runes','material_points',...abilityKeys.map(k=>`${k}_growth`),...abilityKeys.map(k=>`${k}_bonus`)];
  if(!await db.prepare('SELECT id FROM characters WHERE id=?').bind(id).first())throw new HttpError(404,'NOT_FOUND','キャラクターが見つかりません。');
  await db.prepare(`UPDATE characters SET ${cols.map(c=>`${c}=?`).join(',')} WHERE id=?`).bind(...values,id).run();
  return json(mapCharacter((await db.prepare(`${characterSelect} WHERE c.id=?`).bind(id).first())!));
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
  const rows=await db.prepare('SELECT id,name,effect FROM talismans ORDER BY id').all();
  return json(rows.results.map(row=>({id:Number(row.id),name:String(row.name),effect:String(row.effect)})));
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
  await db.prepare('UPDATE talismans SET name=?,effect=? WHERE id=?').bind(text(input,'name'),text(input,'effect'),id).run();
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
    statements.push(db.prepare('INSERT INTO talismans(name,effect) VALUES(?,?)').bind(text(input,'name'),text(input,'effect')));
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
