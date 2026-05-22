import { Injectable, OnDestroy } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root'
})
export class SignalRService implements OnDestroy {
  private hubConnection?: signalR.HubConnection;
  private authToken: string | null = null;
  private intentionalStop = false;
  private readonly onVisibilityChange = () => this.handleVisibilityChange();

  public telemetryUpdates$ = new Subject<Record<string, unknown>>();
  public alertNotifications$ = new Subject<Record<string, unknown>>();

  constructor(private readonly config: AppConfigService) {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    void this.stopConnection();
    this.telemetryUpdates$.complete();
    this.alertNotifications$.complete();
  }

  public async startConnection(token: string): Promise<void> {
    this.authToken = token;
    this.intentionalStop = false;
    await this.ensureConnected();
  }

  public async reconnect(): Promise<void> {
    if (!this.authToken || this.intentionalStop) return;
    await this.ensureConnected();
  }

  private async ensureConnected(): Promise<void> {
    if (!this.authToken) return;

    if (!this.hubConnection) {
      this.buildConnection();
    }

    const state = this.hubConnection!.state;
    if (state === signalR.HubConnectionState.Connected) {
      this.registerListeners();
      return;
    }

    if (state === signalR.HubConnectionState.Connecting
      || state === signalR.HubConnectionState.Reconnecting) {
      return;
    }

    try {
      await this.hubConnection!.start();
      console.log('SignalR connection established');
      this.registerListeners();
    } catch (err) {
      console.error('Error establishing SignalR connection:', err);
    }
  }

  private buildConnection(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.config.hubUrl, {
        accessTokenFactory: () => this.authToken ?? ''
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    this.hubConnection.onreconnected(() => {
      console.log('SignalR reconnected');
      this.registerListeners();
    });

    this.hubConnection.onclose((error) => {
      if (error) {
        console.warn('SignalR connection closed:', error);
      }
      if (!this.intentionalStop && this.authToken && typeof navigator !== 'undefined' && navigator.onLine) {
        setTimeout(() => void this.ensureConnected(), 3000);
      }
    });
  }

  private registerListeners(): void {
    if (!this.hubConnection) return;

    this.hubConnection.off('ReceiveTelemetry');
    this.hubConnection.off('ReceiveAlert');

    this.hubConnection.on('ReceiveTelemetry', (data: Record<string, unknown>) => {
      this.telemetryUpdates$.next(data);
    });

    this.hubConnection.on('ReceiveAlert', (data: Record<string, unknown>) => {
      this.alertNotifications$.next(data);
    });
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.reconnect();
    }
  }

  private handleOnline(): void {
    void this.reconnect();
  }

  public async stopConnection(): Promise<void> {
    this.intentionalStop = true;
    this.authToken = null;
    if (this.hubConnection) {
      this.hubConnection.off('ReceiveTelemetry');
      this.hubConnection.off('ReceiveAlert');
      try {
        await this.hubConnection.stop();
      } catch {
        /* already stopped */
      }
      this.hubConnection = undefined;
    }
  }
}
