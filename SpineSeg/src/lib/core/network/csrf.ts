export function getCSRFToken() {
    if (window.CSRF_TOKEN) return window.CSRF_TOKEN;

    if (typeof document === 'undefined') return null;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${'csrftoken'}=`);
    if (parts.length === 2) return parts.pop()!.split(';').shift()!;
    
    return null;
}