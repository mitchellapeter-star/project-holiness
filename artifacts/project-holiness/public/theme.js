(function () {
  const STORAGE_KEY = 'project-holiness-theme';
  const THEMES = {
    classic: { name: 'Classic', desc: 'Warm parchment', colors: ['#f5f1e9', '#ebe3d0', '#2d4c3c', '#d4af37'] },
    sage: { name: 'Sage', desc: 'Soft botanical', colors: ['#edf3ee', '#dce9df', '#426b54', '#8a9f65'] },
    blush: { name: 'Rose', desc: 'Warm and gentle', colors: ['#f8eff1', '#f2dfe3', '#8a5362', '#b98291'] },
    sky: { name: 'Sky', desc: 'Calm blue', colors: ['#eef5f8', '#dcebf1', '#42687a', '#7d9ead'] },
    lavender: { name: 'Lavender', desc: 'Quiet and reflective', colors: ['#f3f0f8', '#e6e0f1', '#66577f', '#9a8bb4'] },
    butter: { name: 'Butter', desc: 'Soft golden', colors: ['#faf6e9', '#f0e7c9', '#6b6845', '#a4884c'] },
  };

  function getStored() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  }

  function applyTheme(theme, dark) {
    const safeTheme = THEMES[theme] ? theme : 'classic';
    const activeTheme = dark ? 'dark' : safeTheme;

    /* Classic is the untouched default. Do not add the theme attribute unless
       the user actually selected a non-default appearance or dark mode. */
    if (!dark && safeTheme === 'classic') {
      delete document.documentElement.dataset.phTheme;
    } else {
      document.documentElement.dataset.phTheme = activeTheme;
    }
    document.documentElement.classList.toggle('dark', !!dark);

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: safeTheme, dark: !!dark })); } catch {}
    window.dispatchEvent(new CustomEvent('project-holiness-theme-change', { detail: { theme: safeTheme, dark: !!dark } }));
  }

  function isSettingsRoute() {
    return /^\/settings\/?$/.test(window.location.pathname);
  }

  function removeAppearance() {
    document.getElementById('ph-appearance')?.remove();
  }

  const stored = getStored();
  applyTheme(stored.theme || 'classic', !!stored.dark);

  function mountSettings() {
    if (!isSettingsRoute()) {
      removeAppearance();
      return;
    }
    if (document.getElementById('ph-appearance')) return;

    /* SettingsPage currently uses “Coming soon…”; use includes so the
       punctuation does not prevent the appearance panel from mounting. */
    const heading = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.trim().startsWith('Coming soon'));
    const placeholder = heading?.closest('div.rounded-3xl');
    if (!placeholder) return;

    placeholder.style.display = 'none';

    const panel = document.createElement('section');
    panel.id = 'ph-appearance';
    panel.className = 'ph-appearance';
    panel.setAttribute('aria-label', 'Appearance settings');
    panel.innerHTML = `
      <div class="ph-appearance__header">
        <div>
          <h3>Appearance</h3>
          <p style="margin:.35rem 0 0;font-size:.85rem;line-height:1.5">Choose a visual style for Project Holiness. Your choice is saved on this device.</p>
        </div>
        <label class="ph-appearance__mode">
          <span>Dark mode</span>
          <input id="ph-dark-toggle" class="ph-appearance__toggle" type="checkbox" aria-label="Dark mode" />
        </label>
      </div>
      <div id="ph-theme-grid" class="ph-theme-grid"></div>
    `;

    placeholder.parentElement?.appendChild(panel);

    const grid = panel.querySelector('#ph-theme-grid');
    Object.entries(THEMES).forEach(([key, theme]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ph-theme';
      button.dataset.theme = key;
      button.innerHTML = `
        <span class="ph-theme__swatch" aria-hidden="true">${theme.colors.map(color => `<span style="background:${color}"></span>`).join('')}</span>
        <span class="ph-theme__name">${theme.name}</span>
        <span class="ph-theme__desc">${theme.desc}</span>
      `;
      button.addEventListener('click', () => applyTheme(key, false));
      grid?.appendChild(button);
    });

    panel.querySelector('#ph-dark-toggle')?.addEventListener('change', event => {
      const current = getStored();
      applyTheme(current.theme || 'classic', event.target.checked);
    });

    syncSettingsControls();
  }

  function syncSettingsControls() {
    const state = getStored();
    const toggle = document.getElementById('ph-dark-toggle');
    if (toggle) toggle.checked = !!state.dark;
    document.querySelectorAll('.ph-theme').forEach(button => {
      button.classList.toggle('is-active', !state.dark && button.dataset.theme === (state.theme || 'classic'));
    });
  }

  /* The app is a client-side router, so watch both DOM changes and history navigation.
     Appearance is deliberately mounted only on the real /settings route. */
  const originalPushState = history.pushState;
  history.pushState = function () {
    const result = originalPushState.apply(this, arguments);
    setTimeout(mountSettings, 0);
    return result;
  };
  const originalReplaceState = history.replaceState;
  history.replaceState = function () {
    const result = originalReplaceState.apply(this, arguments);
    setTimeout(mountSettings, 0);
    return result;
  };

  const observer = new MutationObserver(mountSettings);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', mountSettings);
  window.addEventListener('hashchange', mountSettings);
  window.addEventListener('project-holiness-theme-change', syncSettingsControls);
  document.addEventListener('DOMContentLoaded', mountSettings);
  setTimeout(mountSettings, 250);
})();
