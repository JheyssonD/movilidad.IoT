import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fleet-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fleet-list.component.html',
  styleUrl: './fleet-list.component.css'
})
export class FleetListComponent {
  @Input() vehiclesList: any[] = [];
  @Input() selectedVehicleId: string | null = null;
  @Output() vehicleSelected = new EventEmitter<string>();

  selectVehicle(vehicleId: string) {
    this.vehicleSelected.emit(vehicleId);
  }

  isFuelCritical(vehicle: { fuelLevel: number; averageConsumptionPerHour?: number }): boolean {
    const consumption = vehicle.averageConsumptionPerHour ?? 0;
    if (consumption <= 0 || vehicle.fuelLevel <= 0) return false;
    return vehicle.fuelLevel / consumption < 1.0;
  }
}
