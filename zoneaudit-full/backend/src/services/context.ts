import type { Config } from '../config.js';
import type { Store } from '../db.js';
import type { GoogleVerifier } from '../auth/google.js';
import type { Repo, Template, TemplateItem, Zone } from '../dataverse/types.js';

export interface AppContext {
  cfg: Config;
  store: Store;
  repo: Repo;
  googleVerifier?: GoogleVerifier;
  master: MasterCache;
}

/** Zones / templates / items change rarely - cache briefly to avoid hammering Dataverse on every list page. */
export class MasterCache {
  private cache = new Map<string, { at: number; value: unknown }>();

  constructor(
    private repo: Repo,
    private ttlMs = 60_000,
  ) {}

  private async memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value as T;
    const value = await load();
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  invalidate() {
    this.cache.clear();
  }

  zones(): Promise<Zone[]> {
    return this.memo('zones', () => this.repo.listZones());
  }
  templates(): Promise<Template[]> {
    return this.memo('templates', () => this.repo.listTemplates());
  }
  items(): Promise<TemplateItem[]> {
    return this.memo('items', () => this.repo.listItems());
  }
}
