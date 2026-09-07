const script = `
(function() {
  function isAdmin() {
    try {
      var token = localStorage.getItem('accessToken');
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

export function DevToolsAdminScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
