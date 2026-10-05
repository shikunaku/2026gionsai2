import fs from 'fs';
import path from 'path';
import { EquipmentItem } from '../src/lib/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'equipments.json');

export class PersistenceManager {
  private static instance: PersistenceManager;

  private constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  public static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager();
    }
    return PersistenceManager.instance;
  }

  public loadEquipments(): EquipmentItem[] {
    try {
      if (fs.existsSync(FILE_PATH)) {
        const raw = fs.readFileSync(FILE_PATH, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[Persistence] Error loading equipments.json:', err);
    }
    return [];
  }

  public saveEquipments(equipments: EquipmentItem[]): void {
    try {
      fs.writeFileSync(FILE_PATH, JSON.stringify(equipments, null, 2), 'utf-8');
      console.log(`[Persistence] Saved ${equipments.length} equipments to equipments.json`);
    } catch (err) {
      console.error('[Persistence] Error saving equipments.json:', err);
    }
  }
}

export const persistence = PersistenceManager.getInstance();
