import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stats-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats-cards.component.html',
  styleUrl: './stats-cards.component.css'
})
export class StatsCardsComponent {
  @Input() monitoredCount = 0;
  @Input() lowAutonomyCount: number | string = 0;
  @Input() userRole = 'User';
  @Input() averageSpeed = 62.4;
}
