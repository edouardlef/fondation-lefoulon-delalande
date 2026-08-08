/**
 * i18n.js — Système de traduction multilingue
 * Langues : FR (défaut), EN
 * Usage: data-i18n="clé.sous-clé" sur les éléments HTML
 */

const I18n = (() => {
  const SUPPORTED = ['fr', 'en'];
  const DEFAULT   = 'fr';
  const LS_KEY    = 'fld_lang';

  let _translations = {};
  let _currentLang  = DEFAULT;

  /** Résout une clé pointée dans un objet imbriqué */
  function resolve(obj, key) {
    return key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj);
  }

  /** Récupère le JSON de traduction pour une langue */
  async function loadLang(lang) {
    if (_translations[lang]) return _translations[lang];
    try {
      const base = document.documentElement.dataset.base || '';
      const r = await fetch(`${base}assets/i18n/${lang}.json`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      _translations[lang] = await r.json();
      return _translations[lang];
    } catch (e) {
      console.warn(`[i18n] Failed to load ${lang}:`, e);
      return null;
    }
  }

  /** Applique les traductions sur le DOM */
  function applyTranslations(t) {
    if (!t) return;

    // Textes simples: data-i18n="clé"
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = resolve(t, key);
      if (val === null) return;
      if (typeof val === 'string') {
        el.innerHTML = val;  // innerHTML pour supporter <em>, <strong>
      }
    });

    // Attributs: data-i18n-attr="attr:clé"
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const pairs = el.dataset.i18nAttr.split(',');
      pairs.forEach(pair => {
        const [attr, key] = pair.trim().split(':');
        const val = resolve(t, key.trim());
        if (val !== null) el.setAttribute(attr.trim(), val);
      });
    });

    // Placeholder: data-i18n-placeholder="clé"
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const val = resolve(t, el.dataset.i18nPlaceholder);
      if (val !== null) el.setAttribute('placeholder', val);
    });

    // lang + dir sur <html>
    document.documentElement.lang = t.lang || _currentLang;
    document.documentElement.dir  = t.dir  || 'ltr';
  }

  /** Change la langue */
  async function setLang(lang, save = true) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT;
    _currentLang = lang;
    if (save) localStorage.setItem(LS_KEY, lang);

    const t = await loadLang(lang);
    applyTranslations(t);
    updateLangButtons(lang);

    document.dispatchEvent(new CustomEvent('langChanged', { detail: { lang, translations: t } }));
    return t;
  }

  /** Met à jour l'état des boutons de langue */
  function updateLangButtons(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
      btn.setAttribute('aria-pressed', btn.dataset.lang === lang ? 'true' : 'false');
    });
  }

  /** Initialisation */
  async function init() {
    // Langue sauvegardée → attr HTML → navigateur → défaut
    const saved   = localStorage.getItem(LS_KEY);
    const htmlLang = document.documentElement.lang?.slice(0, 2).toLowerCase();
    const navLang  = navigator.language?.slice(0, 2).toLowerCase();

    let detected = DEFAULT;
    if (saved   && SUPPORTED.includes(saved))    detected = saved;
    else if (htmlLang && SUPPORTED.includes(htmlLang)) detected = htmlLang;
    else if (navLang  && SUPPORTED.includes(navLang))  detected = navLang;

    await setLang(detected, false);

    // Bind des boutons langue
    document.addEventListener('click', e => {
      const btn = e.target.closest('.lang-btn');
      if (btn && btn.dataset.lang) setLang(btn.dataset.lang);
    });
  }

  /** Raccourci de traduction */
  function t(key) {
    const tr = _translations[_currentLang] || {};
    return resolve(tr, key) ?? key;
  }

  return { init, setLang, t, get currentLang() { return _currentLang; } };
})();

export default I18n;
