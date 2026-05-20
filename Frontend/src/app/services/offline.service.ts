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

@Injectable({
  providedIn: 'root'
})
export class OfflineService extends Dexie {
  telemetryCache!: Table<TelemetryCache>;

  constructor() {
    super('SimonMovilidadIoTDB');
    this.version(1).stores({
      telemetryCache: '++id, vehicleId, timestamp'
    });
  }

  async saveTelemetryLocally(telemetry: TelemetryCache): Promise<void> {
    await this.telemetryCache.add(telemetry);
  }

  async getLocalTelemetries(): Promise<TelemetryCache[]> {
    return await this.telemetryCache.toArray();
  }

  async clearCache(): Promise<void> {
    await this.telemetryCache.clear();
  }
}
