import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: './dist',
			assets: './dist',
			fallback: 'index.html', // Essential for SPA routing
			precompress: false,
			strict: true
		}),
		appDir: 'static'
	}
};

export default config;
