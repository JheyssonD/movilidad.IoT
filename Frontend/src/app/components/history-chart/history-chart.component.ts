import { Component, Input, OnChanges, SimpleChanges, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-history-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-chart.component.html',
  styleUrl: './history-chart.component.css'
})
export class HistoryChartComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() selectedVehicleId: string | null = null;
  @Input() telemetriesHistory: any[] = [];

  private chart?: Chart;

  ngAfterViewInit() {
    this.initChart();
    this.updateChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chart && (changes['selectedVehicleId'] || changes['telemetriesHistory'])) {
      this.updateChart();
    }
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
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

    if (!this.selectedVehicleId) {
      this.chart.data.labels = [];
      this.chart.data.datasets[0].data = [];
      this.chart.data.datasets[1].data = [];
      this.chart.update();
      return;
    }

    const filtered = this.telemetriesHistory
      .filter(t => t.vehicleId === this.selectedVehicleId)
      .slice(0, 10)
      .reverse();

    const labels = filtered.map(t => {
      return t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : '';
    });
    const speeds = filtered.map(t => t.speed);
    const fuels = filtered.map(t => t.fuelLevel);

    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = speeds;
    this.chart.data.datasets[1].data = fuels;
    this.chart.update();
  }
}
