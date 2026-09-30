ALTER TABLE talismans ADD COLUMN weight INTEGER NOT NULL DEFAULT 0;

UPDATE special_items SET name = 'メモリ・ストーン' WHERE id = 7 AND name = 'メモリストーン';

-- Existing characters receive only missing copies of their origin equipment.
INSERT INTO character_weapon_slots (character_id, weapon_id, position, reinforcement_level)
SELECT missing.character_id, missing.weapon_id,
       COALESCE((SELECT MAX(position) FROM character_weapon_slots WHERE character_id=missing.character_id),0)
         + ROW_NUMBER() OVER (PARTITION BY missing.character_id ORDER BY missing.origin_position),
       0
FROM (
  SELECT c.id character_id, oi.weapon_id, oi.position origin_position,
         ROW_NUMBER() OVER (PARTITION BY c.id,oi.weapon_id ORDER BY oi.position) copy_number,
         (SELECT COUNT(*) FROM character_weapon_slots cs WHERE cs.character_id=c.id AND cs.weapon_id=oi.weapon_id) equipped_count
  FROM characters c JOIN origin_initial_weapons oi ON oi.origin_id=c.origin_id
) missing
WHERE missing.copy_number > missing.equipped_count;

INSERT INTO character_shield_slots (character_id, shield_id, position, reinforcement_level)
SELECT missing.character_id, missing.shield_id,
       COALESCE((SELECT MAX(position) FROM character_shield_slots WHERE character_id=missing.character_id),0)
         + ROW_NUMBER() OVER (PARTITION BY missing.character_id ORDER BY missing.origin_position),
       0
FROM (
  SELECT c.id character_id, oi.shield_id, oi.position origin_position,
         ROW_NUMBER() OVER (PARTITION BY c.id,oi.shield_id ORDER BY oi.position) copy_number,
         (SELECT COUNT(*) FROM character_shield_slots cs WHERE cs.character_id=c.id AND cs.shield_id=oi.shield_id) equipped_count
  FROM characters c JOIN origin_initial_shields oi ON oi.origin_id=c.origin_id
) missing
WHERE missing.copy_number > missing.equipped_count;

INSERT OR IGNORE INTO character_equipped_armors (character_id, armor_slot, armor_id)
SELECT c.id, oi.armor_slot, oi.armor_id
FROM characters c JOIN origin_initial_armors oi ON oi.origin_id=c.origin_id;

INSERT OR IGNORE INTO character_learned_skill_sets (character_id, skill_set_id)
SELECT c.id, oi.skill_set_id
FROM characters c JOIN origin_initial_skill_sets oi ON oi.origin_id=c.origin_id;
