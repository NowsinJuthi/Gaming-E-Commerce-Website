const script = `
(function() {
  function isAdmin() {
    try {
      var token = typeof window.__UNIQBD_GET_ACCESS_TOKEN === 'function'
        ? window.__UNIQBD_GET_ACCESS_TOKEN()
        : null;
      if (!token) return false;
      var payload = token.split('.')[1];
      if (!payload) return false;
      var decoded = JSON.parse(atob(payload));
      return Array.isArray(decoded.roles) && decoded.roles.indexOf('admin') !== -1;
    } catch (e) {
      return false;
    }
  }
  function sync() {
    document.documentElement.classList.toggle('dev-tools-admin', isAdmin());
  }
  sync();
  window.addEventListener('auth-change', sync);
  window.addEventListener('storage', sync);
})();
`.trim();

export function DevToolsAdminScript({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
