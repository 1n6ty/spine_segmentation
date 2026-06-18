import { defineConfig, devices } from '@playwright/test';

// Runs against the real docker-compose dev stack (./manage.sh up), not the
// static-only `npm run preview` used by playwright.config.ts — no webServer
// here, and TLS is self-signed (Traefik's dev cert), hence ignoreHTTPSErrors.
export default defineConfig({
	testDir: 'e2e/live',
	timeout: 180_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: 'https://localhost',
		ignoreHTTPSErrors: true,
		trace: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], channel: 'chrome' }
		}
	]
});
