import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-predictive-alerts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './predictive-alerts.component.html',
  styleUrl: './predictive-alerts.component.css'
})
export class PredictiveAlertsComponent {
  @Input() activeAlerts: any[] = [];
  @Input() userRole = 'User';
}
