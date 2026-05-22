import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface RuntimeConfig {
  apiUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: RuntimeConfig = { apiUrl: environment.apiUrl };

  async load(): Promise<void> {
    try {
      const res = await fetch('/assets/config.json', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as Partial<RuntimeConfig>;
        if (json.apiUrl) {
          this.config = { apiUrl: json.apiUrl.replace(/\/$/, '') };
        }
      }
    } catch {
      /* fallback: environment / build default */
    }
  }

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  get hubUrl(): string {
    return `${this.apiUrl}/telemetryHub`;
  }
}
