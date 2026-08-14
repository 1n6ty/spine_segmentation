import { defineConfig, devices } from '@playwright/test';

// Runs against the real docker-compose dev stack (./manage.sh up), not the
// static-only `npm run preview` used by playwright.config.ts — no webServer
// here, and TLS is self-signed (Traefik's dev cert), hence ignoreHTTPSErrors.
//
// E2E_BASE_URL override: `./manage.sh test-e2e` runs this suite from inside a
// throwaway container on the same Docker network as the stack, not on the
// host -- there it hits nginx directly (`http://nginx`, no TLS, no Traefik)
// rather than the host-facing `https://localhost` a developer would use
// running this locally against `./manage.sh up`.
export default defineConfig({
	testDir: 'e2e/live',
	timeout: 180_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: process.env.E2E_BASE_URL ?? 'https://localhost',
		ignoreHTTPSErrors: true,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	// No `channel: 'chrome'` -- that requires a separate `playwright install
	// chrome` step for the real Google Chrome binary, which the
	// mcr.microsoft.com/playwright base image (used by `./manage.sh test-e2e`'s
	// e2e image) doesn't ship. Bundled Chromium (also what playwright.config.ts
	// uses for the mocked suite) is already installed there with zero setup.
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
