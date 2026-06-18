export function getCSRFToken() {
    // The cookie must take priority over window.CSRF_TOKEN: Django's login()
    // calls rotate_token() to prevent session fixation, issuing a fresh
    // csrftoken cookie — but window.CSRF_TOKEN is embedded once into the
    // initial page load's HTML and never updated, since this is an SPA with
    // no full reload after login. Using the stale value here would 403 every
    // CSRF-protected request made after logging in.
    if (typeof document !== 'undefined') {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${'csrftoken'}=`);
        if (parts.length === 2) return parts.pop()!.split(';').shift()!;
    }

    if (window.CSRF_TOKEN) return window.CSRF_TOKEN;

    return null;
}