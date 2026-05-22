import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

export interface MapTelemetry {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number;
  fuelLevel: number;
  averageConsumptionPerHour: number;
  temperature: number;
  timestamp: string;
}

interface VehicleTrack {
  route: L.Polyline;
  points: L.LatLng[];
  animFrameId?: number;
  pendingTarget?: L.LatLng;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `<div id="map-container"></div>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    #map-container {
      width: 100%;
      height: 100%;
      border-radius: var(--border-radius-md);
      border: 1px solid var(--border-color);
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
      position: relative;
      z-index: 1;
    }
  `]
})
export class MapComponent implements OnInit, OnDestroy {
  @Output() userMapInteraction = new EventEmitter<void>();
  @Output() vehicleSelected = new EventEmitter<string>();

  private map!: L.Map;
  private markers: { [vehicleId: string]: L.Marker } = {};
  private tracks: { [vehicleId: string]: VehicleTrack } = {};
  private programmaticMove = false;
  private programmaticMoveCount = 0;
  private followVehicleId: string | null = null;
  private autoFollowEnabled = false;
  private lastCenterPan = 0;
  private tileLayer?: L.TileLayer;
  private readonly onDragStart = () => {
    if (!this.programmaticMove) this.userMapInteraction.emit();
  };
  private readonly onZoomStart = () => {
    if (!this.programmaticMove) this.userMapInteraction.emit();
  };

  /** Intervalo máximo SignalR (10 s); la duración real depende de velocidad y distancia. */
  private readonly MAX_ANIM_MS = 9800;
  private readonly MIN_ANIM_MS = 1500;
  private readonly ROUTE_MAX_POINTS = 400;
  private readonly MIN_MOVE_METERS = 3;
  private readonly CENTER_PAN_THROTTLE_MS = 280;

  ngOnInit() {
    this.initMap();
  }

  ngOnDestroy() {
    this.destroyMapLayers();
    if (this.map) {
      this.map.off('dragstart', this.onDragStart);
      this.map.off('zoomstart', this.onZoomStart);
      if (this.tileLayer) {
        this.map.removeLayer(this.tileLayer);
      }
      this.map.remove();
      this.map = undefined!;
    }
    this.markers = {};
    this.tracks = {};
  }

  private destroyMapLayers(): void {
    Object.values(this.tracks).forEach(t => {
      if (t.animFrameId !== undefined) {
        cancelAnimationFrame(t.animFrameId);
        t.animFrameId = undefined;
      }
      if (this.map) {
        this.map.removeLayer(t.route);
      }
    });
    Object.values(this.markers).forEach(m => {
      if (this.map) {
        this.map.removeLayer(m);
      }
      m.remove();
    });
  }

  public static normalizeTelemetry(raw: Record<string, unknown>): MapTelemetry | null {
    const vehicleId = (raw['vehicleId'] ?? raw['VehicleId']) as string;
    const latitude = Number(raw['latitude'] ?? raw['Latitude']);
    const longitude = Number(raw['longitude'] ?? raw['Longitude']);
    if (!vehicleId || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return null;
    }
    return {
      vehicleId,
      latitude,
      longitude,
      speed: Number(raw['speed'] ?? raw['Speed'] ?? 0),
      fuelLevel: Number(raw['fuelLevel'] ?? raw['FuelLevel'] ?? 0),
      averageConsumptionPerHour: Math.max(
        0.1,
        Number(raw['averageConsumptionPerHour'] ?? raw['AverageConsumptionPerHour'] ?? 6.5)
      ),
      temperature: Number(raw['temperature'] ?? raw['Temperature'] ?? 0),
      timestamp: String(raw['timestamp'] ?? raw['Timestamp'] ?? new Date().toISOString())
    };
  }

  public setFollowVehicle(vehicleId: string | null, enabled: boolean) {
    this.followVehicleId = vehicleId;
    this.autoFollowEnabled = enabled;
  }

  public refreshMapSize() {
    if (!this.map) return;
    this.map.invalidateSize();
  }

  /** Encuadra todos los marcadores (útil con flota multi-ciudad). */
  public fitAllMarkers() {
    if (!this.map) return;
    const latlngs = Object.values(this.markers)
      .map(m => m.getLatLng())
      .filter(ll => ll.lat !== 0 || ll.lng !== 0);
    if (latlngs.length === 0) return;

    this.programmaticMove = true;
    if (latlngs.length === 1) {
      this.map.setView(latlngs[0], 13, { animate: true });
    } else {
      this.map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48], maxZoom: 12, animate: true });
    }
    this.programmaticMove = false;
  }

  private initMap() {
    this.map = L.map('map-container', {
      zoomControl: true,
      attributionControl: false
    }).setView([4.57, -74.3], 6); // Vista nacional: flota en varias ciudades

    this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    });
    this.tileLayer.addTo(this.map);

    this.map.on('dragstart', this.onDragStart);
    this.map.on('zoomstart', this.onZoomStart);
  }

  public flyToVehicle(vehicleId: string) {
    const marker = this.markers[vehicleId];
    if (!this.map || !marker) return;
    this.refreshMapSize();
    const latlng = marker.getLatLng();
    this.runProgrammaticMove(() => {
      this.map.flyTo(latlng, 15, { animate: true, duration: 0.8 });
      marker.openPopup();
    });
  }

  public centerOnVehicle(vehicleId: string) {
    const marker = this.markers[vehicleId];
    if (!this.map || !marker) return;
    this.refreshMapSize();
    const latlng = marker.getLatLng();
    const zoom = this.map.getZoom() >= 14 ? this.map.getZoom() : 15;
    this.runProgrammaticMove(() => {
      this.map.setView(latlng, zoom, { animate: true, duration: 0.35 });
    });
  }

  private runProgrammaticMove(action: () => void) {
    this.programmaticMoveCount++;
    this.programmaticMove = true;
    action();
    this.map.once('moveend', () => {
      this.programmaticMoveCount = Math.max(0, this.programmaticMoveCount - 1);
      if (this.programmaticMoveCount === 0) {
        this.programmaticMove = false;
      }
    });
  }

  /** Colocación instantánea (carga inicial / historial). */
  public placeVehicleImmediate(telemetry: MapTelemetry) {
    this.applyTelemetry(telemetry, true);
  }

  /** Movimiento animado + trazo de ruta (SignalR en tiempo real). */
  public moveVehicleAlongRoute(telemetry: MapTelemetry) {
    this.applyTelemetry(telemetry, false);
  }

  /** @deprecated Use placeVehicleImmediate or moveVehicleAlongRoute */
  public updateVehiclePosition(telemetry: Record<string, unknown>, _role: string, immediate = false) {
    const normalized = MapComponent.normalizeTelemetry(telemetry);
    if (!normalized) return;
    this.applyTelemetry(normalized, immediate);
  }

  private applyTelemetry(telemetry: MapTelemetry, immediate: boolean) {
    if (!this.map) return;

    const vehicleId = telemetry.vehicleId;
    const target = L.latLng(telemetry.latitude, telemetry.longitude);
    const isCritical = telemetry.fuelLevel / telemetry.averageConsumptionPerHour < 1.0;
    const icon = this.buildVehicleIcon(isCritical);
    const popup = this.getPopupHtml(telemetry, isCritical);

    if (!this.markers[vehicleId]) {
      const marker = L.marker(target, { icon }).addTo(this.map).bindPopup(popup);
      marker.on('click', () => {
        this.vehicleSelected.emit(vehicleId);
      });
      this.markers[vehicleId] = marker;
      this.ensureTrack(vehicleId, isCritical);
      this.tracks[vehicleId].points = [target];
      this.tracks[vehicleId].route.setLatLngs([target]);
      return;
    }

    const marker = this.markers[vehicleId];
    marker.setIcon(icon);
    marker.setPopupContent(popup);
    this.ensureTrack(vehicleId, isCritical);

    const from = marker.getLatLng();
    if (from.distanceTo(target) < this.MIN_MOVE_METERS) {
      return;
    }

    if (immediate) {
      const track = this.tracks[vehicleId];
      const frameId = track.animFrameId;
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
        track.animFrameId = undefined;
      }
      marker.setLatLng(target);
      this.tracks[vehicleId].points.push(target);
      if (this.tracks[vehicleId].points.length > this.ROUTE_MAX_POINTS) {
        this.tracks[vehicleId].points = this.tracks[vehicleId].points.slice(-this.ROUTE_MAX_POINTS);
      }
      this.tracks[vehicleId].route.setLatLngs(this.tracks[vehicleId].points);
      return;
    }

    const durationMs = this.computeAnimDurationMs(from, target, telemetry.speed);
    this.animateVehicleAlongRoute(vehicleId, from, target, isCritical, durationMs);
  }

  private computeAnimDurationMs(from: L.LatLng, to: L.LatLng, speedKmh: number): number {
    const distM = from.distanceTo(to);
    if (speedKmh < 1 || distM < this.MIN_MOVE_METERS) {
      return this.MAX_ANIM_MS;
    }
    const hours = distM / 1000 / speedKmh;
    const ms = hours * 3600 * 1000;
    return Math.min(this.MAX_ANIM_MS, Math.max(this.MIN_ANIM_MS, ms));
  }

  private animateVehicleAlongRoute(
    vehicleId: string,
    from: L.LatLng,
    to: L.LatLng,
    isCritical: boolean,
    durationMs: number
  ) {
    const marker = this.markers[vehicleId];
    const track = this.tracks[vehicleId];

    const prevFrame = track.animFrameId;
    if (prevFrame !== undefined) {
      cancelAnimationFrame(prevFrame);
    }

    track.pendingTarget = to;
    track.route.setStyle({ color: isCritical ? '#ef4444' : '#3b82f6' });

    const routeBase = [...track.points];
    const lastCommitted = routeBase[routeBase.length - 1];
    if (!lastCommitted || lastCommitted.distanceTo(from) > 2) {
      routeBase.push(from);
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = this.easeInOutQuad(t);
      const lat = from.lat + (to.lat - from.lat) * eased;
      const lng = from.lng + (to.lng - from.lng) * eased;
      const current = L.latLng(lat, lng);

      marker.setLatLng(current);
      track.route.setLatLngs([...routeBase, current]);

      if (this.autoFollowEnabled && this.followVehicleId === vehicleId) {
        this.throttledCenterOn(current);
      }

      if (t < 1) {
        track.animFrameId = requestAnimationFrame(step);
      } else {
        track.animFrameId = undefined;
        track.pendingTarget = undefined;
        marker.setLatLng(to);
        const tail = track.points[track.points.length - 1];
        if (!tail || tail.distanceTo(to) > 2) {
          track.points.push(to);
        }
        if (track.points.length > this.ROUTE_MAX_POINTS) {
          track.points = track.points.slice(-this.ROUTE_MAX_POINTS);
        }
        track.route.setLatLngs(track.points);
      }
    };

    track.animFrameId = requestAnimationFrame(step);
  }

  private throttledCenterOn(latlng: L.LatLng) {
    const now = performance.now();
    if (now - this.lastCenterPan < this.CENTER_PAN_THROTTLE_MS) return;
    this.lastCenterPan = now;
    if (!this.map) return;
    
    this.runProgrammaticMove(() => {
      this.map.panTo(latlng, { animate: true, duration: 0.25 });
    });
  }

  private ensureTrack(vehicleId: string, isCritical: boolean) {
    if (this.tracks[vehicleId]) return;

    const route = L.polyline([], {
      color: isCritical ? '#ef4444' : '#3b82f6',
      weight: 4,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    this.tracks[vehicleId] = { route, points: [] };
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private buildVehicleIcon(isCritical: boolean): L.DivIcon {
    const markerColor = isCritical ? '#ef4444' : '#3b82f6';
    const glowClass = isCritical ? 'glow-danger' : '';
    return L.divIcon({
      html: `
        <div class="custom-neon-marker ${glowClass}" style="
          width: 32px; height: 32px; background: ${markerColor};
          border: 2px solid white; border-radius: 50%;
          box-shadow: 0 0 10px ${markerColor};
          display: flex; justify-content: center; align-items: center;
          color: white; font-size: 12px; cursor: pointer;
        ">
          <i class="fa-solid fa-car-side"></i>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  private getPopupHtml(telemetry: MapTelemetry, isCritical: boolean): string {
    const speed = telemetry.speed.toFixed(1);
    const fuel = telemetry.fuelLevel.toFixed(1);
    const temp = telemetry.temperature.toFixed(1);
    const time = new Date(telemetry.timestamp).toLocaleTimeString();
    return `
      <div style="font-family: var(--font-family-body); width: 180px; color: white;">
        <h4 style="margin-bottom: 8px; color: ${isCritical ? '#ef4444' : '#3b82f6'};">
          <i class="fa-solid fa-truck-pickup"></i> ${telemetry.vehicleId}
        </h4>
        <div style="font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
          <div><strong>Velocidad:</strong> ${speed} km/h</div>
          <div><strong>Combustible:</strong> ${fuel} L</div>
          <div><strong>Temperatura:</strong> ${temp} °C</div>
          <div style="color: #9ca3af; font-size: 10px; margin-top: 4px;">
            <i class="fa-regular fa-clock"></i> Act: ${time}
          </div>
        </div>
      </div>
    `;
  }
}
