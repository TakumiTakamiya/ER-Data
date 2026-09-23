export interface CharacterRow {
  id: string;
  name: string;
  level: number;
  classId: string;
  vigor: number;
  mind: number;
  endurance: number;
  notes: string;
  updatedAt: string;
  sheetRow: number;
}

export interface ClassRow {
  id: string;
  name: string;
  guardBonus: number;
  description: string;
}

export interface CharacterViewModel extends CharacterRow {
  classInfo: ClassRow | null;
  guard: number | null;
}

export interface CharacterInput {
  id?: string;
  name: string;
  level: number;
  classId: string;
  vigor: number;
  mind: number;
  endurance: number;
  notes: string;
}

export interface SheetData {
  characters: CharacterViewModel[];
  classes: ClassRow[];
}
