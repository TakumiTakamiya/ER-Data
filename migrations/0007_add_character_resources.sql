ALTER TABLE characters ADD COLUMN max_hp_modifier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN max_fp_modifier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN max_blessing_modifier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN flask_total_modifier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN crimson_flask_heal_modifier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN crimson_flask_allocation INTEGER NOT NULL DEFAULT 0 CHECK (crimson_flask_allocation >= 0);
ALTER TABLE characters ADD COLUMN cerulean_flask_heal_modifier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN cerulean_flask_allocation INTEGER NOT NULL DEFAULT 0 CHECK (cerulean_flask_allocation >= 0);

UPDATE special_items SET name = '聖杯の雫' WHERE id = 6 AND name = '聖杯瓶の雫';
