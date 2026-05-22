import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection!: signalR.HubConnection;
  public telemetryUpdates$ = new Subject<any>();
  public alertNotifications$ = new Subject<any>();

  constructor() {}

  public startConnection(token: string): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5100/telemetryHub', {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('SignalR connection established!'))
      .catch(err => console.error('Error establishing SignalR connection: ', err));

    this.registerListeners();
  }

  private registerListeners(): void {
    this.hubConnection.on('ReceiveTelemetry', (data) => {
      this.telemetryUpdates$.next(data);
    });

    this.hubConnection.on('ReceiveAlert', (data) => {
      this.alertNotifications$.next(data);
    });
  }

  public stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }
}
