import {
  ACCENT_STORAGE_KEY,
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
} from "@/lib/theme";
import type { SiteAppearance } from "@/lib/site-appearance";

function buildThemeScript(defaults: Pick<SiteAppearance, "defaultTheme" | "accent">) {
  return `
(function() {
  var VALID = { light:1, dark:1, system:1, gaming:1, amoled:1 };
  var VALID_ACC = { indigo:1, violet:1, cyan:1, emerald:1, rose:1 };
  var SITE_THEME = ${JSON.stringify(defaults.defaultTheme)};
  var SITE_ACCENT = ${JSON.stringify(defaults.accent)};
  function resolve(pref) {
    if (pref === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return VALID[pref] ? pref : '${DEFAULT_THEME_PREFERENCE}';
  }
  try {
    var pref = SITE_THEME && VALID[SITE_THEME] ? SITE_THEME : '${DEFAULT_THEME_PREFERENCE}';
    var accent = SITE_ACCENT && VALID_ACC[SITE_ACCENT] ? SITE_ACCENT : 'emerald';
    var customized = false;
    var raw = localStorage.getItem('uniqbd-theme-store');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state) {
        customized = parsed.state.customized === true;
        if (customized) {
          if (parsed.state.theme && VALID[parsed.state.theme]) pref = parsed.state.theme;
          if (parsed.state.accent && VALID_ACC[parsed.state.accent]) accent = parsed.state.accent;
        }
      }
    } else {
      var lt = localStorage.getItem('${THEME_STORAGE_KEY}');
      var la = localStorage.getItem('${ACCENT_STORAGE_KEY}');
      if (lt && VALID[lt]) {
        pref = lt;
        customized = true;
      }
      if (la && VALID_ACC[la]) {
        accent = la;
        customized = true;
      }
    }
    var resolved = resolve(pref);
    var root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.themePreference = pref;
    root.dataset.accent = accent;
    if (resolved !== 'light') root.classList.add('dark');
    root.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
  } catch (e) {}
})();
`.trim();
}

export function ThemeScript({
  defaults,
}: {
  defaults: Pick<SiteAppearance, "defaultTheme" | "accent">;
}) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: buildThemeScript(defaults) }}
      suppressHydrationWarning
    />
  );
}
