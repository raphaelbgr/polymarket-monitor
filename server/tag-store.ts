/**
 * File-based tag override store.
 * Loads/saves from data/tag-overrides.json.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { TagOverride } from "../lib/shared/tags";

const DATA_DIR = join(dirname(new URL(import.meta.url).pathname), "data");
const FILE_PATH = join(DATA_DIR, "tag-overrides.json");

// Normalize the path for Windows (remove leading / from /C:/...)
function normalizePath(p: string): string {
  if (process.platform === "win32" && p.startsWith("/")) {
    return p.slice(1);
  }
  return p;
}

export class TagStore {
  private overrides: Map<string, TagOverride> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    const filePath = normalizePath(FILE_PATH);
    const dataDir = normalizePath(DATA_DIR);
    try {
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, "utf-8");
        const arr = JSON.parse(raw) as TagOverride[];
        this.overrides.clear();
        for (const o of arr) {
          this.overrides.set(o.conditionId, o);
        }
      }
    } catch {
      // Start fresh if file is corrupt
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
    const arr = Array.from(this.overrides.values());
    writeFileSync(filePath, JSON.stringify(arr, null, 2));
  }

  get(conditionId: string): TagOverride | undefined {
    return this.overrides.get(conditionId);
  }

  getAll(): Map<string, TagOverride> {
    return new Map(this.overrides);
  }

  getAllArray(): TagOverride[] {
    return Array.from(this.overrides.values());
  }

  set(conditionId: string, addTags: string[], removeTags: string[]): void {
    this.overrides.set(conditionId, { conditionId, addTags, removeTags });
    this.save();
  }

  delete(conditionId: string): boolean {
    const existed = this.overrides.delete(conditionId);
    if (existed) this.save();
    return existed;
  }
}
