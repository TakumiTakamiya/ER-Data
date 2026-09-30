CREATE TABLE adventures (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE origins (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  initial_level INTEGER NOT NULL CHECK (initial_level >= 0),
  initial_vigor INTEGER NOT NULL CHECK (initial_vigor >= 0),
  initial_mind INTEGER NOT NULL CHECK (initial_mind >= 0),
  initial_endurance INTEGER NOT NULL CHECK (initial_endurance >= 0),
  initial_strength INTEGER NOT NULL CHECK (initial_strength >= 0),
  initial_dexterity INTEGER NOT NULL CHECK (initial_dexterity >= 0),
  initial_intelligence INTEGER NOT NULL CHECK (initial_intelligence >= 0),
  initial_faith INTEGER NOT NULL CHECK (initial_faith >= 0),
  initial_arcane INTEGER NOT NULL CHECK (initial_arcane >= 0)
);

CREATE TABLE armor_sets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  series_effect TEXT NOT NULL DEFAULT ''
);

CREATE TABLE armors (
  id INTEGER PRIMARY KEY,
  armor_set_id INTEGER REFERENCES armor_sets(id) ON DELETE SET NULL,
  name TEXT NOT NULL UNIQUE,
  armor_slot TEXT NOT NULL CHECK (armor_slot IN ('HEAD', 'BODY')),
  weight INTEGER NOT NULL CHECK (weight >= 0),
  physical_cut INTEGER NOT NULL,
  phenomenon_cut INTEGER NOT NULL,
  poise INTEGER NOT NULL
);

CREATE TABLE weapon_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  size TEXT NOT NULL,
  attack_cost INTEGER NOT NULL CHECK (attack_cost >= 0),
  one_hand_damage_1 TEXT NOT NULL,
  one_hand_damage_2 TEXT NOT NULL,
  one_hand_damage_3 TEXT NOT NULL,
  one_hand_damage_4 TEXT NOT NULL,
  one_hand_damage_5 TEXT NOT NULL,
  two_hand_damage_1 TEXT NOT NULL,
  two_hand_damage_2 TEXT NOT NULL,
  two_hand_damage_3 TEXT NOT NULL,
  two_hand_damage_4 TEXT NOT NULL,
  two_hand_damage_5 TEXT NOT NULL,
  guard_cost INTEGER NOT NULL CHECK (guard_cost >= 0),
  one_hand_physical_guard TEXT NOT NULL,
  two_hand_physical_guard TEXT NOT NULL,
  one_hand_phenomenon_guard TEXT NOT NULL,
  two_hand_phenomenon_guard TEXT NOT NULL
);

CREATE TABLE weapons (
  id INTEGER PRIMARY KEY,
  weapon_category_id INTEGER NOT NULL REFERENCES weapon_categories(id),
  name TEXT NOT NULL UNIQUE,
  weight INTEGER NOT NULL CHECK (weight >= 0),
  power_modifier TEXT NOT NULL,
  required_strength INTEGER NOT NULL CHECK (required_strength >= 0),
  required_dexterity INTEGER NOT NULL CHECK (required_dexterity >= 0),
  required_intelligence INTEGER NOT NULL CHECK (required_intelligence >= 0),
  required_faith INTEGER NOT NULL CHECK (required_faith >= 0),
  required_arcane INTEGER NOT NULL CHECK (required_arcane >= 0)
);

CREATE TABLE shield_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  size TEXT NOT NULL
);

CREATE TABLE shields (
  id INTEGER PRIMARY KEY,
  shield_category_id INTEGER NOT NULL REFERENCES shield_categories(id),
  name TEXT NOT NULL UNIQUE,
  weight INTEGER NOT NULL CHECK (weight >= 0),
  guard_cost INTEGER NOT NULL CHECK (guard_cost >= 0),
  physical_guard TEXT NOT NULL,
  phenomenon_guard TEXT NOT NULL,
  required_strength INTEGER NOT NULL CHECK (required_strength >= 0),
  required_dexterity INTEGER NOT NULL CHECK (required_dexterity >= 0),
  required_intelligence INTEGER NOT NULL CHECK (required_intelligence >= 0),
  required_faith INTEGER NOT NULL CHECK (required_faith >= 0),
  required_arcane INTEGER NOT NULL CHECK (required_arcane >= 0)
);

CREATE TABLE talismans (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  effect TEXT NOT NULL
);

CREATE TABLE skills (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  classification TEXT NOT NULL,
  timing TEXT NOT NULL CHECK (timing IN ('AC', 'RE', 'TRIGGER', 'PASSIVE')),
  target TEXT NOT NULL,
  cost TEXT NOT NULL,
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses >= 0)
);

CREATE TABLE skill_rank_effects (
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  effect TEXT NOT NULL,
  PRIMARY KEY (skill_id, rank)
);

CREATE TABLE skill_sets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE skill_set_members (
  skill_set_id INTEGER NOT NULL REFERENCES skill_sets(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  position INTEGER NOT NULL CHECK (position >= 1),
  PRIMARY KEY (skill_set_id, skill_id),
  UNIQUE (skill_set_id, position)
);

CREATE TABLE special_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE episodes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  episode_type TEXT NOT NULL CHECK (episode_type IN ('MAIN', 'SIDE')),
  episode_number INTEGER NOT NULL,
  display_code TEXT NOT NULL UNIQUE,
  malice_level INTEGER NOT NULL CHECK (malice_level >= 0),
  UNIQUE (episode_type, episode_number),
  CHECK (
    (episode_type = 'MAIN' AND episode_number BETWEEN 0 AND 11)
    OR (episode_type = 'SIDE' AND episode_number BETWEEN 1 AND 10)
  )
);

CREATE TABLE spirit_ashes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  party_slot_cost INTEGER NOT NULL CHECK (party_slot_cost >= 0),
  summon_cost TEXT NOT NULL,
  summon_count INTEGER NOT NULL CHECK (summon_count >= 0),
  level INTEGER NOT NULL CHECK (level >= 0),
  movement_modifier INTEGER NOT NULL,
  perception_modifier INTEGER NOT NULL,
  physical_cut INTEGER NOT NULL,
  phenomenon_cut INTEGER NOT NULL,
  guard_count INTEGER NOT NULL CHECK (guard_count >= 0),
  guard_cut_rate INTEGER NOT NULL CHECK (guard_cut_rate >= 0),
  evasion_count INTEGER NOT NULL CHECK (evasion_count >= 0),
  special_ability TEXT NOT NULL DEFAULT '',
  main_action_name TEXT NOT NULL,
  main_action_target TEXT NOT NULL,
  main_action_damage TEXT NOT NULL,
  sub_action_name TEXT NOT NULL,
  sub_action_target TEXT NOT NULL,
  sub_action_damage TEXT NOT NULL,
  action_special_effect TEXT NOT NULL DEFAULT ''
);

CREATE TABLE spirit_ash_upgrade_effects (
  spirit_ash_id INTEGER NOT NULL REFERENCES spirit_ashes(id) ON DELETE CASCADE,
  upgrade_level INTEGER NOT NULL CHECK (upgrade_level BETWEEN 1 AND 5),
  effect TEXT NOT NULL,
  PRIMARY KEY (spirit_ash_id, upgrade_level)
);

CREATE TABLE armor_skills (
  armor_id INTEGER NOT NULL REFERENCES armors(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  PRIMARY KEY (armor_id, skill_id)
);

CREATE TABLE armor_set_skills (
  armor_set_id INTEGER NOT NULL REFERENCES armor_sets(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  PRIMARY KEY (armor_set_id, skill_id)
);

CREATE TABLE weapon_skills (
  weapon_id INTEGER NOT NULL REFERENCES weapons(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  PRIMARY KEY (weapon_id, skill_id)
);

CREATE TABLE weapon_category_skills (
  weapon_category_id INTEGER NOT NULL REFERENCES weapon_categories(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  PRIMARY KEY (weapon_category_id, skill_id)
);

CREATE TABLE shield_skills (
  shield_id INTEGER NOT NULL REFERENCES shields(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  PRIMARY KEY (shield_id, skill_id)
);

CREATE TABLE skill_weapon_categories (
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  weapon_category_id INTEGER NOT NULL REFERENCES weapon_categories(id),
  PRIMARY KEY (skill_id, weapon_category_id)
);

CREATE TABLE skill_shield_categories (
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  shield_category_id INTEGER NOT NULL REFERENCES shield_categories(id),
  PRIMARY KEY (skill_id, shield_category_id)
);

CREATE TABLE origin_initial_skill_sets (
  origin_id INTEGER NOT NULL REFERENCES origins(id) ON DELETE CASCADE,
  skill_set_id INTEGER NOT NULL REFERENCES skill_sets(id),
  PRIMARY KEY (origin_id, skill_set_id)
);

CREATE TABLE origin_initial_weapons (
  id INTEGER PRIMARY KEY,
  origin_id INTEGER NOT NULL REFERENCES origins(id) ON DELETE CASCADE,
  weapon_id INTEGER NOT NULL REFERENCES weapons(id),
  position INTEGER NOT NULL CHECK (position >= 1),
  UNIQUE (origin_id, position)
);

CREATE TABLE origin_initial_shields (
  id INTEGER PRIMARY KEY,
  origin_id INTEGER NOT NULL REFERENCES origins(id) ON DELETE CASCADE,
  shield_id INTEGER NOT NULL REFERENCES shields(id),
  position INTEGER NOT NULL CHECK (position >= 1),
  UNIQUE (origin_id, position)
);

CREATE TABLE origin_initial_armors (
  origin_id INTEGER NOT NULL REFERENCES origins(id) ON DELETE CASCADE,
  armor_slot TEXT NOT NULL CHECK (armor_slot IN ('HEAD', 'BODY')),
  armor_id INTEGER NOT NULL REFERENCES armors(id),
  PRIMARY KEY (origin_id, armor_slot)
);

CREATE TABLE characters (
  id INTEGER PRIMARY KEY,
  adventure_id INTEGER NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  origin_id INTEGER NOT NULL REFERENCES origins(id),
  name TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 0),
  runes INTEGER NOT NULL DEFAULT 0 CHECK (runes >= 0),
  material_points INTEGER NOT NULL DEFAULT 0 CHECK (material_points >= 0),
  vigor_growth INTEGER NOT NULL DEFAULT 0 CHECK (vigor_growth >= 0),
  mind_growth INTEGER NOT NULL DEFAULT 0 CHECK (mind_growth >= 0),
  endurance_growth INTEGER NOT NULL DEFAULT 0 CHECK (endurance_growth >= 0),
  strength_growth INTEGER NOT NULL DEFAULT 0 CHECK (strength_growth >= 0),
  dexterity_growth INTEGER NOT NULL DEFAULT 0 CHECK (dexterity_growth >= 0),
  intelligence_growth INTEGER NOT NULL DEFAULT 0 CHECK (intelligence_growth >= 0),
  faith_growth INTEGER NOT NULL DEFAULT 0 CHECK (faith_growth >= 0),
  arcane_growth INTEGER NOT NULL DEFAULT 0 CHECK (arcane_growth >= 0),
  vigor_bonus INTEGER NOT NULL DEFAULT 0,
  mind_bonus INTEGER NOT NULL DEFAULT 0,
  endurance_bonus INTEGER NOT NULL DEFAULT 0,
  strength_bonus INTEGER NOT NULL DEFAULT 0,
  dexterity_bonus INTEGER NOT NULL DEFAULT 0,
  intelligence_bonus INTEGER NOT NULL DEFAULT 0,
  faith_bonus INTEGER NOT NULL DEFAULT 0,
  arcane_bonus INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE character_weapon_slots (
  id INTEGER PRIMARY KEY,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  weapon_id INTEGER REFERENCES weapons(id),
  position INTEGER NOT NULL CHECK (position >= 1),
  reinforcement_level INTEGER NOT NULL DEFAULT 0 CHECK (reinforcement_level >= 0),
  UNIQUE (character_id, position)
);

CREATE TABLE character_shield_slots (
  id INTEGER PRIMARY KEY,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  shield_id INTEGER REFERENCES shields(id),
  position INTEGER NOT NULL CHECK (position >= 1),
  reinforcement_level INTEGER NOT NULL DEFAULT 0 CHECK (reinforcement_level >= 0),
  UNIQUE (character_id, position)
);

CREATE TABLE character_equipped_armors (
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  armor_slot TEXT NOT NULL CHECK (armor_slot IN ('HEAD', 'BODY')),
  armor_id INTEGER NOT NULL REFERENCES armors(id),
  PRIMARY KEY (character_id, armor_slot)
);

CREATE TABLE character_equipped_talismans (
  id INTEGER PRIMARY KEY,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  talisman_id INTEGER NOT NULL REFERENCES talismans(id),
  position INTEGER NOT NULL CHECK (position >= 1),
  UNIQUE (character_id, position)
);

CREATE TABLE character_learned_skill_sets (
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_set_id INTEGER NOT NULL REFERENCES skill_sets(id),
  PRIMARY KEY (character_id, skill_set_id)
);

CREATE TABLE character_equipped_skills (
  id INTEGER PRIMARY KEY,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  position INTEGER NOT NULL CHECK (position >= 1),
  rank INTEGER NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 3),
  UNIQUE (character_id, skill_id),
  UNIQUE (character_id, position)
);

CREATE TABLE adventure_weapons (
  adventure_id INTEGER NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  weapon_id INTEGER NOT NULL REFERENCES weapons(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (adventure_id, weapon_id)
);

CREATE TABLE adventure_shields (
  adventure_id INTEGER NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  shield_id INTEGER NOT NULL REFERENCES shields(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (adventure_id, shield_id)
);

CREATE TABLE adventure_armors (
  adventure_id INTEGER NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  armor_id INTEGER NOT NULL REFERENCES armors(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (adventure_id, armor_id)
);

CREATE TABLE adventure_talismans (
  adventure_id INTEGER NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  talisman_id INTEGER NOT NULL REFERENCES talismans(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (adventure_id, talisman_id)
);

CREATE TABLE adventure_skill_sets (
  adventure_id INTEGER NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  skill_set_id INTEGER NOT NULL REFERENCES skill_sets(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (adventure_id, skill_set_id)
);

CREATE TABLE adventure_spirit_ashes (
  adventure_id INTEGER NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  spirit_ash_id INTEGER NOT NULL REFERENCES spirit_ashes(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (adventure_id, spirit_ash_id)
);

CREATE TABLE adventure_special_items (
  adventure_id INTEGER NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  special_item_id INTEGER NOT NULL REFERENCES special_items(id),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (adventure_id, special_item_id)
);

CREATE TABLE adventure_episode_progress (
  adventure_id INTEGER NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL REFERENCES episodes(id),
  status TEXT NOT NULL CHECK (status IN ('UNLOCKED', 'COMPLETED')),
  PRIMARY KEY (adventure_id, episode_id)
);

CREATE INDEX idx_armors_armor_set_id ON armors(armor_set_id);
CREATE INDEX idx_weapons_category_id ON weapons(weapon_category_id);
CREATE INDEX idx_shields_category_id ON shields(shield_category_id);
CREATE INDEX idx_skill_set_members_skill_id ON skill_set_members(skill_id);
CREATE INDEX idx_armor_skills_skill_id ON armor_skills(skill_id);
CREATE INDEX idx_armor_set_skills_skill_id ON armor_set_skills(skill_id);
CREATE INDEX idx_weapon_skills_skill_id ON weapon_skills(skill_id);
CREATE INDEX idx_weapon_category_skills_skill_id ON weapon_category_skills(skill_id);
CREATE INDEX idx_shield_skills_skill_id ON shield_skills(skill_id);
CREATE INDEX idx_skill_weapon_categories_category_id ON skill_weapon_categories(weapon_category_id);
CREATE INDEX idx_skill_shield_categories_category_id ON skill_shield_categories(shield_category_id);
CREATE INDEX idx_origin_initial_skill_sets_set_id ON origin_initial_skill_sets(skill_set_id);
CREATE INDEX idx_origin_initial_weapons_weapon_id ON origin_initial_weapons(weapon_id);
CREATE INDEX idx_origin_initial_shields_shield_id ON origin_initial_shields(shield_id);
CREATE INDEX idx_origin_initial_armors_armor_id ON origin_initial_armors(armor_id);
CREATE INDEX idx_characters_adventure_id ON characters(adventure_id);
CREATE INDEX idx_characters_origin_id ON characters(origin_id);
CREATE INDEX idx_character_weapon_slots_weapon_id ON character_weapon_slots(weapon_id);
CREATE INDEX idx_character_shield_slots_shield_id ON character_shield_slots(shield_id);
CREATE INDEX idx_character_equipped_armors_armor_id ON character_equipped_armors(armor_id);
CREATE INDEX idx_character_equipped_talismans_talisman_id ON character_equipped_talismans(talisman_id);
CREATE INDEX idx_character_learned_skill_sets_set_id ON character_learned_skill_sets(skill_set_id);
CREATE INDEX idx_character_equipped_skills_skill_id ON character_equipped_skills(skill_id);
CREATE INDEX idx_adventure_weapons_weapon_id ON adventure_weapons(weapon_id);
CREATE INDEX idx_adventure_shields_shield_id ON adventure_shields(shield_id);
CREATE INDEX idx_adventure_armors_armor_id ON adventure_armors(armor_id);
CREATE INDEX idx_adventure_talismans_talisman_id ON adventure_talismans(talisman_id);
CREATE INDEX idx_adventure_skill_sets_set_id ON adventure_skill_sets(skill_set_id);
CREATE INDEX idx_adventure_spirit_ashes_ash_id ON adventure_spirit_ashes(spirit_ash_id);
CREATE INDEX idx_adventure_special_items_item_id ON adventure_special_items(special_item_id);
CREATE INDEX idx_adventure_episode_progress_episode_id ON adventure_episode_progress(episode_id);
