/**
 * File-based filter preset store.
 * CRUD operations for data/presets.json.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { FilterPreset } from "../lib/shared/filters";

const DATA_DIR = join(dirname(new URL(import.meta.url).pathname), "data");
const FILE_PATH = join(DATA_DIR, "presets.json");

function normalizePath(p: string): string {
  if (process.platform === "win32" && p.startsWith("/")) {
    return p.slice(1);
  }
  return p;
}

export class PresetStore {
  private presets: Map<string, FilterPreset> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    const filePath = normalizePath(FILE_PATH);
    const dataDir = normalizePath(DATA_DIR);
    try {
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, "utf-8");
        const arr = JSON.parse(raw) as FilterPreset[];
        this.presets.clear();
        for (const p of arr) {
          this.presets.set(p.id, p);
        }
      }
    } catch {
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }
    }
  }

  private save(): void {
    const dataDir = normalizePath(DATA_DIR);
    const filePath = normalizePath(FILE_PATH);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    const arr = Array.from(this.presets.values());
    writeFileSync(filePath, JSON.stringify(arr, null, 2));
  }

  getAll(): FilterPreset[] {
    return Array.from(this.presets.values());
  }

  get(id: string): FilterPreset | undefined {
    return this.presets.get(id);
  }

  set(preset: FilterPreset): void {
    this.presets.set(preset.id, preset);
    this.save();
  }

  delete(id: string): boolean {
    const existed = this.presets.delete(id);
    if (existed) this.save();
    return existed;
  }
}
