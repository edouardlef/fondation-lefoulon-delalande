/**
 * include.js — Génère la sidebar et le footer communs
 * Appelé AVANT main.js, sans dépendances de module
 */

(function () {
  /* ── Sidebar HTML ─────────────────────────────────────────── */
  const LOGO_URL  = 'https://www.fondation-lefoulon-delalande.fr/wp-content/uploads/2021/09/output-onlinepngtools-1.png';
  const LOGO_FOOT = 'https://www.fondation-lefoulon-delalande.fr/wp-content/uploads/2026/01/logofooter-300x64.png';

  // Toutes les pages HTML sont à la racine du projet → base = ''
  // Si le projet est déplacé dans un sous-dossier serveur, ajuster ici.
  const base = '';
  document.documentElement.dataset.base = base;

  // ── Source des données (actualités / suggestions) ──────────────
  // '' (défaut)  → JSON statiques générés par le sync (assets/data/*.json)
  // URL du worker → tout passe par le back Cloudflare, ex :
  //   'https://fondation-worker.<compte>.workers.dev'
  const API_BASE = '';
  window.FLD_DATA = (kind) =>
    API_BASE ? `${API_BASE}/api/${kind}` : `${base}assets/data/${kind}.json`;

  const PAGES = [
    { key: 'home',      href: 'index.html',                       icon: 'home',     i18n: 'nav.home',      sub: [] },
    { key: 'about',     href: 'a-propos.html',                    icon: 'info',     i18n: 'nav.about',     hasSub: true, sub: [
        { href: 'a-propos.html#mission',    i18n: 'nav.mission'   },
        { href: 'a-propos.html#histoire',   i18n: 'nav.history'   },
        { href: 'a-propos.html#gouvernance',i18n: 'nav.governance' },
    ]},
    { key: 'prix',      href: 'grand-prix-scientifique.html',     icon: 'award',    i18n: 'nav.grand_prix',sub: [] },
    { key: 'bourses',   href: 'bourses-de-recherche.html',        icon: 'book',     i18n: 'nav.grants',    sub: [] },
    { key: 'news',      href: 'actualites.html',                  icon: 'rss',      i18n: 'nav.news',      sub: [] },
    { key: 'suggest',   href: 'ce-qui-pourrait-vous-interesser.html', icon: 'star', i18n: 'nav.suggestions',sub: [] },
    { key: 'contact',   href: 'informations-pratiques.html',      icon: 'mail',     i18n: 'nav.contact',   sub: [] },
  ];

  const ICONS = {
    home:    `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    info:    `<svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    award:   `<svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>`,
    book:    `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    rss:     `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>`,
    star:    `<svg class="nav-icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    mail:    `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    globe:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    arrow:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`,
  };

  // Labels par défaut (pour tooltip title avant chargement i18n)
  const LABELS_FR = {
    'nav.home': 'Accueil', 'nav.about': 'À propos', 'nav.grand_prix': 'Grand Prix',
    'nav.grants': 'Bourses', 'nav.news': 'Actualités',
    'nav.suggestions': 'Ce qui pourrait vous intéresser', 'nav.contact': 'Contact',
    'nav.solutions': 'Lefoulon Solutions',
    'nav.mission': 'Mission', 'nav.history': 'Histoire', 'nav.governance': 'Gouvernance'
  };

  function buildNavItems() {
    return PAGES.map(p => {
      const hasSub  = p.hasSub && p.sub.length;
      const label   = LABELS_FR[p.i18n] || p.i18n;
      const subHTML = hasSub
        ? `<ul class="nav-submenu">${p.sub.map(s =>
            `<li><a href="${base}${s.href}" title="${LABELS_FR[s.i18n] || s.i18n}" data-i18n="${s.i18n}">${s.i18n}</a></li>`
          ).join('')}</ul>`
        : '';
      // NB : pas de data-i18n sur le <a> lui-même — i18n.js remplace l'innerHTML
      // et détruirait l'icône ; seul le <span class="nav-label"> est traduit.
      return `
        <li class="nav-item${hasSub ? ' has-sub' : ''}">
          <a href="${base}${p.href}" class="nav-link" title="${label}" data-i18n-attr="title:${p.i18n}">
            ${ICONS[p.icon]}
            <span class="nav-label" data-i18n="${p.i18n}">${label}</span>
            ${hasSub ? `<span class="nav-arrow">${ICONS.arrow}</span>` : ''}
          </a>
          ${subHTML}
        </li>`;
    }).join('');
  }

  const sidebarHTML = `
    <nav id="sidebar" class="sidebar" aria-label="Navigation principale" aria-expanded="false">
      <a href="${base}index.html" class="sidebar-logo">
        <img class="logo-img" src="${LOGO_URL}" alt="Fondation Lefoulon-Delalande">
        <span class="logo-text">
          <strong>Fondation Lefoulon</strong>
          <em>Delalande</em>
        </span>
      </a>

      <ul class="nav-menu" role="list">
        ${buildNavItems()}
      </ul>

      <div class="sidebar-foot">
        <div class="lang-globe">${ICONS.globe}</div>
        <div class="lang-switcher" role="group" aria-label="Sélection de la langue">
          <button class="lang-btn" data-lang="fr" aria-pressed="true">FR</button>
          <button class="lang-btn" data-lang="en" aria-pressed="false">EN</button>
        </div>
      </div>
    </nav>

    <div id="sidebarOverlay" class="sidebar-overlay" aria-hidden="true"></div>`;

  /* ── Footer HTML ──────────────────────────────────────────── */
  const footerHTML = `
    <footer>
      <div class="footer-inner">
        <div class="footer-grid">
          <div class="footer-brand">
            <img class="footer-logo" src="${LOGO_FOOT}" alt="Fondation Lefoulon-Delalande">
            <p data-i18n="footer.tagline">Fondée en 2000 sous l'égide de l'Institut de France, la Fondation Lefoulon-Delalande soutient la recherche médicale cardiovasculaire.</p>
            <address class="address">
              Institut de France<br>
              23 quai de Conti<br>
              75006 Paris
            </address>
          </div>
          <div class="footer-col">
            <h4 data-i18n="footer.nav_title">Navigation</h4>
            <ul>
              <li><a href="${base}index.html" data-i18n="nav.home">Accueil</a></li>
              <li><a href="${base}a-propos.html" data-i18n="nav.about">À propos</a></li>
              <li><a href="${base}grand-prix-scientifique.html" data-i18n="nav.grand_prix">Grand Prix</a></li>
              <li><a href="${base}bourses-de-recherche.html" data-i18n="nav.grants">Bourses</a></li>
              <li><a href="${base}actualites.html" data-i18n="nav.news">Actualités</a></li>
              <li><a href="${base}informations-pratiques.html" data-i18n="nav.contact">Contact</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4 data-i18n="footer.legal_title">Informations</h4>
            <ul>
              <li><a href="${base}mentions-legales.html" data-i18n="footer.legal_link">Mentions légales</a></li>
              <li><a href="${base}politique-confidentialite.html" data-i18n="footer.privacy_link">Politique de confidentialité</a></li>
              <li><a href="${base}ce-qui-pourrait-vous-interesser.html" data-i18n="nav.suggestions">Ce qui pourrait vous intéresser</a></li>
              <li><a href="${base}lefoulon-solutions.html" data-i18n="nav.solutions">Lefoulon Solutions →</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4 data-i18n="footer.partners_title">Sous l'égide de</h4>
            <ul>
              <li><a href="https://www.institut-de-france.fr" target="_blank" rel="noopener">Institut de France</a></li>
              <li><a href="https://www.academie-sciences.fr" target="_blank" rel="noopener">Académie des sciences</a></li>
              <li><a href="https://www.inserm.fr" target="_blank" rel="noopener">INSERM</a></li>
            </ul>
          </div>
        </div>

        <div class="footer-partners">
          <h4 data-i18n="footer.partners_title">Sous l'égide de</h4>
          <div class="partners-row">
            <a href="https://www.institut-de-france.fr" class="partner-link" target="_blank" rel="noopener">Institut de France</a>
            <a href="https://www.academie-sciences.fr" class="partner-link" target="_blank" rel="noopener">Académie des sciences</a>
            <a href="https://www.inserm.fr" class="partner-link" target="_blank" rel="noopener">INSERM</a>
            <a href="https://www.sfcardio.fr" class="partner-link" target="_blank" rel="noopener">SFC</a>
          </div>
        </div>

        <div class="footer-bottom">
          <span class="footer-copy" data-i18n="footer.copyright">© 2024 Fondation Lefoulon-Delalande. Tous droits réservés.</span>
          <nav class="footer-legal" aria-label="Liens légaux">
            <a href="${base}mentions-legales.html" data-i18n="footer.legal_link">Mentions légales</a>
            <a href="${base}politique-confidentialite.html" data-i18n="footer.privacy_link">Politique de confidentialité</a>
            <a href="${base}informations-pratiques.html" data-i18n="footer.contact_link">Contact</a>
            <a href="${base}lefoulon-solutions.html" data-i18n="nav.solutions" class="text-gold">Lefoulon Solutions →</a>
          </nav>
        </div>
      </div>
    </footer>`;

  /* ── Mobile header HTML ───────────────────────────────────── */
  const mobileHeaderHTML = `
    <header class="mobile-header" role="banner">
      <button class="hamburger" id="menuToggle" aria-label="Ouvrir le menu" aria-controls="sidebar" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <img class="mobile-logo" src="${LOGO_URL}" alt="Fondation Lefoulon-Delalande">
      <div class="site-name">
        <strong>Fondation Lefoulon</strong>
        <em>Delalande</em>
      </div>
    </header>`;

  /* ── Injection ───────────────────────────────────────────── */
  function inject() {
    // Sidebar
    const sidebarEl = document.getElementById('sidebar-placeholder');
    if (sidebarEl) sidebarEl.outerHTML = sidebarHTML;

    // Mobile header
    const mhEl = document.getElementById('mobile-header-placeholder');
    if (mhEl) mhEl.outerHTML = mobileHeaderHTML;

    // Footer
    const footerEl = document.getElementById('footer-placeholder');
    if (footerEl) footerEl.outerHTML = footerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
