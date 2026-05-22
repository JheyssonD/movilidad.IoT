import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SignalRService } from '../../services/signalr.service';
import { OfflineService } from '../../services/offline.service';
import { AppConfigService } from '../../services/app-config.service';
import { MapComponent, MapTelemetry } from '../map/map.component';

import { FleetListComponent } from '../fleet-list/fleet-list.component';
import { StatsCardsComponent } from '../stats-cards/stats-cards.component';
import { HistoryChartComponent } from '../history-chart/history-chart.component';
import { PredictiveAlertsComponent } from '../predictive-alerts/predictive-alerts.component';

export interface ToastNotification {
  id: number;
  type: 'alert' | 'warning' | 'info';
  message: string;
  vehicleId?: string;
  timestamp: Date;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MapComponent,
    FleetListComponent,
    StatsCardsComponent,
    HistoryChartComponent,
    PredictiveAlertsComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(MapComponent) mapComponent!: MapComponent;

  userEmail = '';
  userRole = '';
  isOnline = true;
  activeAlerts: any[] = [];
  vehiclesList: any[] = [];
  get lowAutonomyCount(): number {
    return this.vehiclesList.filter(v => v.averageConsumptionPerHour > 0 && (v.fuelLevel / v.averageConsumptionPerHour) < 1.0).length;
  }
  selectedVehicleId: string | null = null;
  autoFollowMap = true;
  telemetriesHistory: any[] = [];
  toastNotifications: ToastNotification[] = [];
  userMenuOpen = false;
  mobileView: 'map' | 'list' = 'list';

  private signalRConnectionActive = false;
  private telemetrySub?: Subscription;
  private alertSub?: Subscription;
  private historySub?: Subscription;
  private fleetSub?: Subscription;
  private readonly toastTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private toastIdCounter = 0;
  private criticalVehicles = new Set<string>();

  constructor(
    private http: HttpClient,
    private router: Router,
    private signalR: SignalRService,
    private offline: OfflineService,
    private config: AppConfigService
  ) {}

  ngOnInit() {
    this.userEmail = localStorage.getItem('simon_email') || 'Usuario';
    this.userRole = localStorage.getItem('simon_role') || 'User';

    this.isOnline = navigator.onLine;
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);

    this.loadData();
    this.setupSignalR();
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    this.telemetrySub?.unsubscribe();
    this.alertSub?.unsubscribe();
    this.historySub?.unsubscribe();
    this.fleetSub?.unsubscribe();
    this.toastTimeouts.forEach(id => clearTimeout(id));
    this.toastTimeouts.clear();
    void this.signalR.stopConnection();
  }

  onOnline = () => {
    this.isOnline = true;
    this.loadData();
    void this.signalR.reconnect();
  };

  onOffline = () => {
    this.isOnline = false;
    this.loadDataFromOfflineCache();
  };

  loadData() {
    if (!this.isOnline) {
      this.loadDataFromOfflineCache();
      return;
    }

    const token = localStorage.getItem('simon_token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.historySub?.unsubscribe();
    this.historySub = this.http
      .get<any[]>(`${this.config.apiUrl}/api/telemetry/history`, { headers })
      .subscribe({
        next: (res) => {
          this.telemetriesHistory = res;
          this.processVehiclesFromHistory(res);
          this.rebuildActiveAlertsFromHistory();
          this.cacheDataLocally(res);
        },
        error: () => {
          this.loadDataFromOfflineCache();
        }
      });

    this.fleetSub?.unsubscribe();
    this.fleetSub = this.http
      .get<{ vehicleId: string; city: string; routeName: string; startWithCriticalAutonomy?: boolean }[]>(
        `${this.config.apiUrl}/api/telemetry/fleet`,
        { headers }
      )
      .subscribe({
        next: (fleet) => {
          this.mergeFleetManifest(fleet);
          this.rebuildActiveAlertsFromHistory();
        }
      });
  }

  private mergeFleetManifest(
    fleet: { vehicleId: string; city: string; routeName: string; startWithCriticalAutonomy?: boolean }[]
  ) {
    fleet.forEach(f => {
      const demoFuel = 2.5;
      const demoConsumption = 6.5;
      let vehicle = this.vehiclesList.find(v => v.vehicleId === f.vehicleId);

      if (!vehicle) {
        vehicle = {
          vehicleId: f.vehicleId,
          city: f.city,
          routeName: f.routeName,
          speed: 0,
          fuelLevel: f.startWithCriticalAutonomy ? demoFuel : 0,
          averageConsumptionPerHour: f.startWithCriticalAutonomy ? demoConsumption : 6.5,
          latitude: 0,
          longitude: 0,
          pending: !f.startWithCriticalAutonomy,
          demoCritical: !!f.startWithCriticalAutonomy
        };
        this.vehiclesList.push(vehicle);
      } else if (f.startWithCriticalAutonomy) {
        vehicle.fuelLevel = demoFuel;
        vehicle.averageConsumptionPerHour = demoConsumption;
        vehicle.pending = false;
        vehicle.demoCritical = true;
      }

      if (this.userRole === 'Admin' && f.startWithCriticalAutonomy) {
        this.registerActiveAlert(
          f.vehicleId,
          `Alerta combustible crítica (autonomía menor a 1 h) — ${f.city} ${f.vehicleId}`
        );
      }
    });
  }

  async cacheDataLocally(telemetries: any[]) {
    await this.offline.clearCache();
    for (const t of telemetries) {
      await this.offline.saveTelemetryLocally({
        vehicleId: t.vehicleId,
        latitude: t.latitude,
        longitude: t.longitude,
        speed: t.speed,
        fuelLevel: t.fuelLevel,
        averageConsumptionPerHour: t.averageConsumptionPerHour,
        temperature: t.temperature,
        timestamp: t.timestamp
      });
    }
  }

  async loadDataFromOfflineCache() {
    const cached = await this.offline.getLocalTelemetries();
    cached.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
    this.telemetriesHistory = cached;
    this.processVehiclesFromHistory(cached);
  }

  /** Conserva la telemetría más reciente por vehículo (tolerante a respuestas sin agrupar). */
  private latestTelemetryPerVehicle(history: any[]): Map<string, any> {
    const map = new Map<string, any>();
    for (const t of history) {
      const prev = map.get(t.vehicleId);
      const ts = t.timestamp ? new Date(t.timestamp).getTime() : 0;
      const prevTs = prev?.timestamp ? new Date(prev.timestamp).getTime() : 0;
      if (!prev || ts >= prevTs) {
        map.set(t.vehicleId, t);
      }
    }
    return map;
  }

  processVehiclesFromHistory(history: any[]) {
    this.vehiclesList = Array.from(this.latestTelemetryPerVehicle(history).values());

    if (this.vehiclesList.length > 0 && !this.selectedVehicleId) {
      this.selectVehicle(this.vehiclesList[0].vehicleId);
    }

    setTimeout(() => {
      this.vehiclesList.forEach(v => {
        const t = MapComponent.normalizeTelemetry(v);
        if (t && t.latitude !== 0 && t.longitude !== 0) {
          this.mapComponent?.placeVehicleImmediate(t);
        }
      });
      this.mapComponent?.fitAllMarkers();
    }, 100);
  }

  setupSignalR() {
    const token = localStorage.getItem('simon_token');
    if (!token) return;

    this.telemetrySub?.unsubscribe();
    this.alertSub?.unsubscribe();

    void this.signalR.startConnection(token).then(() => {
      this.signalRConnectionActive = true;
    });

    this.telemetrySub = this.signalR.telemetryUpdates$.subscribe(data => {
      const normalized = MapComponent.normalizeTelemetry(data);
      if (!normalized) return;

      const processed: MapTelemetry = { ...normalized };
      if (this.userRole !== 'Admin') {
        processed.vehicleId = this.maskVehicleId(normalized.vehicleId);
      }

      this.telemetriesHistory.unshift(processed);
      if (this.telemetriesHistory.length > 100) {
        this.telemetriesHistory.pop();
      }
      this.telemetriesHistory = [...this.telemetriesHistory];

      this.offline.saveTelemetryLocally(processed);
      this.mapComponent?.moveVehicleAlongRoute(processed);

      const index = this.vehiclesList.findIndex(v => v.vehicleId === processed.vehicleId);
      if (index > -1) {
        const prev = this.vehiclesList[index];
        const keepDemoLowFuel = prev.demoCritical === true;
        this.vehiclesList[index] = {
          ...processed,
          city: prev.city,
          pending: false,
          demoCritical: prev.demoCritical,
          fuelLevel: keepDemoLowFuel && !this.isFuelCritical(processed)
            ? prev.fuelLevel
            : processed.fuelLevel,
          averageConsumptionPerHour: processed.averageConsumptionPerHour || prev.averageConsumptionPerHour
        };
      } else {
        this.vehiclesList.unshift({ ...processed, pending: false });
      }
      this.vehiclesList = [...this.vehiclesList];

      const isCritical = this.isFuelCritical(processed);
      if (isCritical) {
        if (!this.criticalVehicles.has(processed.vehicleId)) {
          this.criticalVehicles.add(processed.vehicleId);
          this.pushToast({
            type: 'warning',
            message: `Combustible crítico en ${processed.vehicleId}`,
            vehicleId: processed.vehicleId
          });
          if (this.userRole === 'Admin') {
            const autonomy = processed.fuelLevel / processed.averageConsumptionPerHour;
            this.registerActiveAlert(
              processed.vehicleId,
              `Combustible crítico (${autonomy.toFixed(2)} h autonomía) — ${processed.vehicleId}`
            );
          }
        }
      } else {
        if (this.criticalVehicles.has(processed.vehicleId)) {
          this.criticalVehicles.delete(processed.vehicleId);
          this.removeActiveAlert(processed.vehicleId);
        }
      }

      if (processed.vehicleId === this.selectedVehicleId) {
        if (this.autoFollowMap) {
          this.mapComponent?.setFollowVehicle(processed.vehicleId, true);
        }
      }
    });

    this.alertSub = this.signalR.alertNotifications$.subscribe(alert => {
      const { vehicleId, message } = this.parseAlertPayload(alert);

      if (this.userRole === 'Admin' && vehicleId) {
        this.registerActiveAlert(vehicleId, message);
      }

      this.pushToast({
        type: 'alert',
        message: `${vehicleId ? vehicleId + ': ' : ''}${message}`,
        vehicleId
      });
    });
  }

  private registerActiveAlert(vehicleId: string, message: string) {
    const entry = {
      id: Date.now() + Math.random().toString(),
      vehicleId,
      message,
      timestamp: new Date()
    };
    this.activeAlerts.unshift(entry);
    if (this.activeAlerts.length > 20) {
      this.activeAlerts = this.activeAlerts.slice(0, 20);
    }
    this.activeAlerts = [...this.activeAlerts];
  }

  private removeActiveAlert(vehicleId: string) {
    this.activeAlerts = this.activeAlerts.filter(a => a.vehicleId !== vehicleId);
  }

  private rebuildActiveAlertsFromHistory() {
    if (this.userRole !== 'Admin') return;
    this.activeAlerts = [];

    this.latestTelemetryPerVehicle(this.telemetriesHistory).forEach(t => {
      if (!this.isFuelCritical(t)) return;
      const consumption = t.averageConsumptionPerHour || 6.5;
      const autonomy = t.fuelLevel / consumption;
      this.registerActiveAlert(
        t.vehicleId,
        `Combustible crítico (${autonomy.toFixed(2)} h autonomía, ${t.fuelLevel.toFixed(1)} L) — ${t.vehicleId}`
      );
    });
  }

  onMapUserInteraction() {
    this.autoFollowMap = false;
    this.mapComponent?.setFollowVehicle(this.selectedVehicleId, false);
  }

  selectVehicle(vehicleId: string) {
    this.selectedVehicleId = vehicleId;
    this.autoFollowMap = true;
    this.mapComponent?.setFollowVehicle(vehicleId, true);
    setTimeout(() => {
      this.mapComponent?.refreshMapSize();
      this.mapComponent?.flyToVehicle(vehicleId);
    }, 50);
    if (this.isMobileViewport()) {
      this.mobileView = 'map';
    }
  }

  clearVehicleSelection() {
    this.selectedVehicleId = null;
    this.autoFollowMap = false;
  }

  setMobileView(view: 'map' | 'list') {
    this.mobileView = view;
    if (view === 'map') {
      setTimeout(() => {
        this.mapComponent?.refreshMapSize();
        if (this.selectedVehicleId && this.autoFollowMap) {
          this.mapComponent?.centerOnVehicle(this.selectedVehicleId);
        }
      }, 80);
    }
  }

  toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu() {
    this.userMenuOpen = false;
  }

  isFuelCritical(vehicle: { fuelLevel: number; averageConsumptionPerHour?: number }): boolean {
    const consumption = vehicle.averageConsumptionPerHour ?? 0;
    if (consumption <= 0 || vehicle.fuelLevel <= 0) return false;
    return vehicle.fuelLevel / consumption < 1.0;
  }

  pushToast(partial: Omit<ToastNotification, 'id' | 'timestamp'>) {
    const toast: ToastNotification = {
      ...partial,
      id: ++this.toastIdCounter,
      timestamp: new Date()
    };
    this.toastNotifications.unshift(toast);
    if (this.toastNotifications.length > 5) {
      this.toastNotifications.pop();
    }
    const timeoutId = setTimeout(() => {
      this.toastTimeouts.delete(timeoutId);
      this.dismissToast(toast.id);
    }, 6000);
    this.toastTimeouts.add(timeoutId);
  }

  dismissToast(id: number) {
    this.toastNotifications = this.toastNotifications.filter(t => t.id !== id);
  }

  private parseAlertPayload(alert: Record<string, unknown>): { vehicleId?: string; message: string } {
    const rawId = alert['vehicleId'] ?? alert['VehicleId'];
    const rawMsg = alert['message'] ?? alert['Message'];
    const vehicleId = typeof rawId === 'string' ? rawId : undefined;
    const message = typeof rawMsg === 'string' ? rawMsg : 'Alerta de combustible crítica';
    return { vehicleId, message };
  }

  maskVehicleId(vehicleId: string): string {
    if (!vehicleId) return '';
    const parts = vehicleId.split('-');
    if (parts.length >= 3) {
      parts[1] = '****';
      return parts.join('-');
    }
    return vehicleId.length > 4 ? vehicleId.substring(0, 4) + '****' : '****';
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 640;
  }

  logout() {
    void this.signalR.stopConnection();
    this.signalRConnectionActive = false;
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
