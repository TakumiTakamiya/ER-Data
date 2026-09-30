CREATE TABLE skill_shield_categories (
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  shield_category_id INTEGER NOT NULL REFERENCES shield_categories(id),
  PRIMARY KEY (skill_id, shield_category_id)
);

CREATE INDEX idx_skill_shield_categories_category_id
  ON skill_shield_categories(shield_category_id);
