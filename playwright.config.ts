import { defineConfig } from '@playwright/test';

// Keep local preview checks local even in environments with a global proxy.
process.env.NO_PROXY = [process.env.NO_PROXY, 'localhost', '127.0.0.1'].filter(Boolean).join(',');
process.env.no_proxy = process.env.NO_PROXY;

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	workers: 3,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:4323',
		viewport: { width: 1440, height: 1000 },
		colorScheme: 'light',
		launchOptions: { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] },
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
	webServer: {
		command: 'npm run preview -- --host 127.0.0.1 --port 4323',
		// Wait for Astro's ready message; probing an unopened localhost port
		// can stall for minutes on machines with a global HTTP proxy.
		wait: { stdout: /http:\/\/(?:127\.0\.0\.1|localhost):4323\// },
		timeout: 20_000,
	},
});
