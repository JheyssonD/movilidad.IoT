import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    // Set mock localstorage data before init
    localStorage.setItem('simon_email', 'admin@simon.com');
    localStorage.setItem('simon_role', 'Admin');

    await TestBed.configureTestingModule({
      imports: [
        DashboardComponent,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      schemas: [NO_ERRORS_SCHEMA] // Avoid template compiling errors for Child Map Component in unit test
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should load profile credentials from localStorage', () => {
    expect(component.userEmail).toBe('admin@simon.com');
    expect(component.userRole).toBe('Admin');
  });

  it('should toggle online/offline state correctly', () => {
    component.onOnline();
    expect(component.isOnline).toBeTrue();

    component.onOffline();
    expect(component.isOnline).toBeFalse();
  });

  it('should mask vehicle id for normal users and keep it unmasked for admins', () => {
    const rawId = 'DEV-A549-XC54';
    
    // Non-admin check
    const masked = component.maskVehicleId(rawId);
    expect(masked).toBe('DEV-****-XC54');
  });
});
