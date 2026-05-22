import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { SignalRService } from '../../services/signalr.service';
import { OfflineService, TelemetryCache } from '../../services/offline.service';
import { MapComponent } from '../map/map.component';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MapComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MapComponent) mapComponent!: MapComponent;

  userEmail = '';
  userRole = '';
  isOnline = true;
  activeAlerts: any[] = [];
  vehiclesList: any[] = [];
  selectedVehicleId = '';
  telemetriesHistory: any[] = [];
  
  private chart!: Chart;
  private signalRConnectionActive = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private signalR: SignalRService,
    private offline: OfflineService
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

  ngAfterViewInit() {
    this.initChart();
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    this.signalR.stopConnection();
  }

  onOnline = () => {
    this.isOnline = true;
    this.loadData();
    if (!this.signalRConnectionActive) {
      this.setupSignalR();
    }
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

    // Fetch history from API (Port 5100 used to avoid default occupied ports)
    this.http.get<any[]>('http://localhost:5100/api/telemetry/history', { headers }).subscribe({
      next: (res) => {
        this.telemetriesHistory = res;
        this.processVehiclesFromHistory(res);
        this.cacheDataLocally(res);
      },
      error: () => {
        this.loadDataFromOfflineCache();
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
    this.telemetriesHistory = cached;
    this.processVehiclesFromHistory(cached);
  }

  processVehiclesFromHistory(history: any[]) {
    // Extract unique vehicles
    const vehiclesMap = new Map<string, any>();
    history.forEach(t => {
      if (!vehiclesMap.has(t.vehicleId)) {
        vehiclesMap.set(t.vehicleId, t);
      }
    });
    this.vehiclesList = Array.from(vehiclesMap.values());

    if (this.vehiclesList.length > 0 && !this.selectedVehicleId) {
      this.selectVehicle(this.vehiclesList[0].vehicleId);
    } else {
      this.updateChart();
    }

    // Feed map with starting points
    setTimeout(() => {
      this.vehiclesList.forEach(v => {
        this.mapComponent?.updateVehiclePosition(v, this.userRole);
      });
    }, 100);
  }

  setupSignalR() {
    const token = localStorage.getItem('simon_token');
    if (!token) return;

    this.signalR.startConnection(token);
    this.signalRConnectionActive = true;

    // Listen to real-time telemetries
    this.signalR.telemetryUpdates$.subscribe(data => {
      // Process telemetry masking locally if not already done by server
      const processed = { ...data };
      if (this.userRole !== 'Admin') {
        processed.vehicleId = this.maskVehicleId(data.vehicleId);
      }

      // Add to history
      this.telemetriesHistory.unshift(processed);
      if (this.telemetriesHistory.length > 100) {
        this.telemetriesHistory.pop();
      }

      // Save to offline cache
      this.offline.saveTelemetryLocally(processed);

      // Update map marker
      this.mapComponent?.updateVehiclePosition(processed, this.userRole);

      // Refresh list
      const index = this.vehiclesList.findIndex(v => v.vehicleId === processed.vehicleId);
      if (index > -1) {
        this.vehiclesList[index] = processed;
      } else {
        this.vehiclesList.unshift(processed);
      }

      if (processed.vehicleId === this.selectedVehicleId) {
        this.updateChart();
      }
    });

    // Listen to real-time critical fuel alerts
    this.signalR.alertNotifications$.subscribe(alert => {
      // Only Admins should see alerts
      if (this.userRole === 'Admin') {
        this.activeAlerts.unshift({
          ...alert,
          timestamp: new Date()
        });
        if (this.activeAlerts.length > 10) {
          this.activeAlerts.pop();
        }
      }
    });
  }

  selectVehicle(vehicleId: string) {
    this.selectedVehicleId = vehicleId;
    this.updateChart();
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

  initChart() {
    const ctx = document.getElementById('historyChart') as HTMLCanvasElement;
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Velocidad (km/h)',
            data: [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'ySpeed'
          },
          {
            label: 'Combustible (L)',
            data: [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'yFuel'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#f9fafb' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          },
          ySpeed: {
            type: 'linear',
            position: 'left',
            ticks: { color: '#3b82f6' },
            grid: { color: '#374151' },
            title: { display: true, text: 'Velocidad', color: '#3b82f6' }
          },
          yFuel: {
            type: 'linear',
            position: 'right',
            ticks: { color: '#f59e0b' },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Combustible', color: '#f59e0b' }
          }
        }
      }
    });
  }

  updateChart() {
    if (!this.chart) return;

    const filtered = this.telemetriesHistory
      .filter(t => t.vehicleId === this.selectedVehicleId)
      .slice(0, 10)
      .reverse();

    const labels = filtered.map(t => new Date(t.timestamp).toLocaleTimeString());
    const speeds = filtered.map(t => t.speed);
    const fuels = filtered.map(t => t.fuelLevel);

    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = speeds;
    this.chart.data.datasets[1].data = fuels;
    this.chart.update();
  }

  logout() {
    this.signalR.stopConnection();
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
