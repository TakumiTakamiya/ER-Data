-- D1 keeps foreign keys enabled during migrations. Back up and recreate every
-- table that references skills so the timing CHECK can be changed safely.
CREATE TABLE _0004_skill_rank_effects AS SELECT * FROM skill_rank_effects;
CREATE TABLE _0004_skill_set_members AS SELECT * FROM skill_set_members;
CREATE TABLE _0004_armor_skills AS SELECT * FROM armor_skills;
CREATE TABLE _0004_armor_set_skills AS SELECT * FROM armor_set_skills;
CREATE TABLE _0004_weapon_skills AS SELECT * FROM weapon_skills;
CREATE TABLE _0004_weapon_category_skills AS SELECT * FROM weapon_category_skills;
CREATE TABLE _0004_shield_skills AS SELECT * FROM shield_skills;
CREATE TABLE _0004_skill_weapon_categories AS SELECT * FROM skill_weapon_categories;
CREATE TABLE _0004_character_equipped_skills AS SELECT * FROM character_equipped_skills;
CREATE TABLE _0004_skills AS SELECT * FROM skills;

DROP TABLE skill_rank_effects;
DROP TABLE skill_set_members;
DROP TABLE armor_skills;
DROP TABLE armor_set_skills;
DROP TABLE weapon_skills;
DROP TABLE weapon_category_skills;
DROP TABLE shield_skills;
DROP TABLE skill_weapon_categories;
DROP TABLE character_equipped_skills;
DROP TABLE skills;

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
CREATE TABLE skill_set_members (
  skill_set_id INTEGER NOT NULL REFERENCES skill_sets(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  position INTEGER NOT NULL CHECK (position >= 1),
  PRIMARY KEY (skill_set_id, skill_id),
  UNIQUE (skill_set_id, position)
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
CREATE TABLE character_equipped_skills (
  id INTEGER PRIMARY KEY,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  position INTEGER NOT NULL CHECK (position >= 1),
  rank INTEGER NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 3),
  UNIQUE (character_id, skill_id),
  UNIQUE (character_id, position)
);

INSERT INTO skills SELECT * FROM _0004_skills;
INSERT INTO skill_rank_effects SELECT * FROM _0004_skill_rank_effects;
INSERT INTO skill_set_members SELECT * FROM _0004_skill_set_members;
INSERT INTO armor_skills SELECT * FROM _0004_armor_skills;
INSERT INTO armor_set_skills SELECT * FROM _0004_armor_set_skills;
INSERT INTO weapon_skills SELECT * FROM _0004_weapon_skills;
INSERT INTO weapon_category_skills SELECT * FROM _0004_weapon_category_skills;
INSERT INTO shield_skills SELECT * FROM _0004_shield_skills;
INSERT INTO skill_weapon_categories SELECT * FROM _0004_skill_weapon_categories;
INSERT INTO character_equipped_skills SELECT * FROM _0004_character_equipped_skills;

CREATE INDEX idx_skill_set_members_skill_id ON skill_set_members(skill_id);
CREATE INDEX idx_armor_skills_skill_id ON armor_skills(skill_id);
CREATE INDEX idx_armor_set_skills_skill_id ON armor_set_skills(skill_id);
CREATE INDEX idx_weapon_skills_skill_id ON weapon_skills(skill_id);
CREATE INDEX idx_weapon_category_skills_skill_id ON weapon_category_skills(skill_id);
CREATE INDEX idx_shield_skills_skill_id ON shield_skills(skill_id);
CREATE INDEX idx_skill_weapon_categories_category_id ON skill_weapon_categories(weapon_category_id);
CREATE INDEX idx_character_equipped_skills_skill_id ON character_equipped_skills(skill_id);

DROP TABLE _0004_skill_rank_effects;
DROP TABLE _0004_skill_set_members;
DROP TABLE _0004_armor_skills;
DROP TABLE _0004_armor_set_skills;
DROP TABLE _0004_weapon_skills;
DROP TABLE _0004_weapon_category_skills;
DROP TABLE _0004_shield_skills;
DROP TABLE _0004_skill_weapon_categories;
DROP TABLE _0004_character_equipped_skills;
DROP TABLE _0004_skills;
