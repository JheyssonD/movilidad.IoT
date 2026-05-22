import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';

export interface TelemetryCache {
  id?: number;
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number;
  fuelLevel: number;
  averageConsumptionPerHour: number;
  temperature: number;
  timestamp: string;
}

const DB_NAME = 'SimonMovilidadIoTDB';
const SCHEMA_VERSION = 3;
const SCHEMA_VERSION_KEY = 'simon_iot_idb_schema_version';
const INIT_LOCK_KEY = 'simon_iot_db_init_lock';

@Injectable({
  providedIn: 'root'
})
export class OfflineService extends Dexie {
  telemetryCache!: Table<TelemetryCache>;
  private readonly ready: Promise<void>;

  constructor() {
    super(DB_NAME);
    this.version(SCHEMA_VERSION).stores({
      telemetryCache: '++id, vehicleId, timestamp'
    });
    (this as unknown as { autoOpen: boolean }).autoOpen = false;
    this.ready = this.initialize();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (ev) => {
        if (ev.key === SCHEMA_VERSION_KEY && ev.newValue !== String(SCHEMA_VERSION)) {
          void this.reopenAfterExternalReset();
        }
      });
    }
  }

  private async acquireInitLock(): Promise<() => void> {
    const lockId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const maxWait = 8000;
    const start = Date.now();

    while (sessionStorage.getItem(INIT_LOCK_KEY)) {
      if (Date.now() - start > maxWait) {
        sessionStorage.removeItem(INIT_LOCK_KEY);
        break;
      }
      await new Promise(r => setTimeout(r, 40));
    }

    sessionStorage.setItem(INIT_LOCK_KEY, lockId);
    return () => {
      if (sessionStorage.getItem(INIT_LOCK_KEY) === lockId) {
        sessionStorage.removeItem(INIT_LOCK_KEY);
      }
    };
  }

  private async initialize(): Promise<void> {
    const release = await this.acquireInitLock();
    try {
      const storedVersion = Number(localStorage.getItem(SCHEMA_VERSION_KEY) ?? 0);

      if (storedVersion !== SCHEMA_VERSION) {
        try {
          await this.close();
        } catch {
          /* DB may not be open yet */
        }
        await Dexie.delete(DB_NAME);
        localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
      }

      try {
        await this.open();
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name;
        if (name === 'UpgradeError' || name === 'DatabaseClosedError' || name === 'VersionError') {
          await Dexie.delete(DB_NAME);
          await this.open();
        } else {
          throw err;
        }
      }
    } finally {
      release();
    }
  }

  private async reopenAfterExternalReset(): Promise<void> {
    try {
      await this.close();
    } catch {
      /* ignore */
    }
    await Dexie.delete(DB_NAME);
    await this.open();
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  async saveTelemetryLocally(telemetry: TelemetryCache): Promise<void> {
    await this.ensureReady();
    await this.telemetryCache.put(telemetry);
  }

  async getLocalTelemetries(): Promise<TelemetryCache[]> {
    await this.ensureReady();
    return await this.telemetryCache.toArray();
  }

  async clearCache(): Promise<void> {
    await this.ensureReady();
    await this.telemetryCache.clear();
  }
}
