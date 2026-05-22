import { TestBed } from '@angular/core/testing';
import { OfflineService, TelemetryCache } from './offline.service';

describe('OfflineService', () => {
  let service: OfflineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OfflineService]
    });
    service = TestBed.inject(OfflineService);
  });

  afterEach(async () => {
    await service.clearCache();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should save and retrieve telemetry locally', async () => {
    const telemetry: TelemetryCache = {
      vehicleId: 'DEV-TEST-XC54',
      latitude: 4.7110,
      longitude: -74.0721,
      speed: 60.5,
      fuelLevel: 45.0,
      averageConsumptionPerHour: 5.0,
      temperature: 82.0,
      timestamp: new Date().toISOString()
    };

    await service.saveTelemetryLocally(telemetry);
    const cached = await service.getLocalTelemetries();

    expect(cached.length).toBe(1);
    expect(cached[0].vehicleId).toBe('DEV-TEST-XC54');
    expect(cached[0].fuelLevel).toBe(45.0);
  });

  it('should clear cache successfully', async () => {
    const telemetry: TelemetryCache = {
      vehicleId: 'DEV-TEST-XC54',
      latitude: 4.7110,
      longitude: -74.0721,
      speed: 60.5,
      fuelLevel: 45.0,
      averageConsumptionPerHour: 5.0,
      temperature: 82.0,
      timestamp: new Date().toISOString()
    };

    await service.saveTelemetryLocally(telemetry);
    await service.clearCache();
    const cached = await service.getLocalTelemetries();

    expect(cached.length).toBe(0);
  });
});
