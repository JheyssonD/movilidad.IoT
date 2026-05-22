import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `<div id="map-container"></div>`,
  styles: [`
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
  private map!: L.Map;
  private markers: { [vehicleId: string]: L.Marker } = {};

  constructor() {}

  ngOnInit() {
    this.initMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap() {
    this.map = L.map('map-container', {
      zoomControl: true,
      attributionControl: false
    }).setView([4.7110, -74.0721], 13);

    // Dark Mode Tile Layer - Premium sleek dark theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    }).addTo(this.map);
  }

  public updateVehiclePosition(telemetry: any, role: string) {
    if (!this.map) return;

    const lat = telemetry.latitude;
    const lng = telemetry.longitude;
    const vehicleId = telemetry.vehicleId;
    const speed = telemetry.speed.toFixed(1);
    const fuel = telemetry.fuelLevel.toFixed(1);
    const temp = telemetry.temperature.toFixed(1);
    const time = new Date(telemetry.timestamp).toLocaleTimeString();
    
    const isCritical = telemetry.fuelLevel / telemetry.averageConsumptionPerHour < 1.0;
    const markerColor = isCritical ? '#ef4444' : '#3b82f6';
    const glowClass = isCritical ? 'glow-danger' : '';

    // HTML-based Glowing Neon Circle Pin (100% immune to asset loading bugs)
    const customIcon = L.divIcon({
      html: `
        <div class="custom-neon-marker ${glowClass}" style="
          width: 32px; 
          height: 32px; 
          background: ${markerColor}; 
          border: 2px solid white; 
          border-radius: 50%; 
          box-shadow: 0 0 10px ${markerColor}; 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          color: white; 
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        ">
          <i class="fa-solid fa-car-side"></i>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (this.markers[vehicleId]) {
      this.markers[vehicleId].setLatLng([lat, lng]);
      this.markers[vehicleId].setIcon(customIcon);
      this.markers[vehicleId].setPopupContent(this.getPopupHtml(vehicleId, speed, fuel, temp, time, isCritical));
    } else {
      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(this.map)
        .bindPopup(this.getPopupHtml(vehicleId, speed, fuel, temp, time, isCritical));
      this.markers[vehicleId] = marker;
    }
  }

  private getPopupHtml(vehicleId: string, speed: string, fuel: string, temp: string, time: string, isCritical: boolean): string {
    return `
      <div style="font-family: var(--font-family-body); width: 180px; color: white;">
        <h4 style="margin-bottom: 8px; color: ${isCritical ? '#ef4444' : '#3b82f6'}; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-truck-pickup"></i> ${vehicleId}
        </h4>
        <div style="font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
          <div><strong>Velocidad:</strong> ${speed} km/h</div>
          <div><strong>Combustible:</strong> ${fuel} L</div>
          <div><strong>Temperatura:</strong> ${temp} °C</div>
          <div style="color: #9ca3af; font-size: 10px; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
            <i class="fa-regular fa-clock"></i> Act: ${time}
          </div>
        </div>
      </div>
    `;
  }
}
