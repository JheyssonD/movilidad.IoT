import { test, expect } from '@playwright/test';

test.describe('Simon Movilidad IoT - Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app (which will redirect to /login)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Login
    await page.fill('input[type="email"]', 'admin@simon.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await expect(page.locator('.dashboard-container')).toBeVisible({ timeout: 10000 });
  });

  test('should display fleet and allow offline mode', async ({ page, context }) => {
    // Wait for the fleet to load (vehicles in the sidebar)
    await expect(page.locator('.vehicle-card').first()).toBeVisible({ timeout: 15000 });

    const vehicleCount = await page.locator('.vehicle-card').count();
    expect(vehicleCount).toBeGreaterThan(0);

    // Click on a vehicle to select it
    await page.locator('.vehicle-card').first().click();

    // Wait for flyTo animation to complete so programmaticMove is false
    await page.waitForTimeout(1500);

    // Verify auto-follow is active by looking for the "Seguir" button (it should NOT be visible initially if it's already following)
    // Wait for the button to appear if we break auto-follow
    
    // Simulate user panning the map to break auto-follow
    const map = page.locator('.map-wrapper');
    const box = await map.boundingBox();
    if (box) {
      const startX = box.x + 40;
      const startY = box.y + 40;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY + 100, { steps: 10 });
      await page.mouse.up();
    }

    // After manual pan, the "Seguir [VehicleId]" button should appear
    await expect(page.locator('.btn-relock')).toBeVisible({ timeout: 5000 });

    // Click "Seguir" again to re-lock
    await page.locator('.btn-relock').click();
    await expect(page.locator('.btn-relock')).not.toBeVisible();

    // Validate Offline Resilience
    // Set network to offline
    await context.setOffline(true);

    // Wait a bit to ensure the app registers offline state (SignalR disconnected)
    await page.waitForTimeout(2000);

    // The badge should indicate Offline
    await expect(page.locator('.status-badge.badge-offline')).toBeVisible({ timeout: 10000 });

    // The data should still be there from offline cache (Dexie)
    const offlineVehicleCount = await page.locator('.vehicle-card').count();
    expect(offlineVehicleCount).toBe(vehicleCount);

    // Reconnect network
    await context.setOffline(false);
    
    // Should go back online
    await expect(page.locator('.status-badge.badge-online')).toBeVisible({ timeout: 15000 });
  });
});
