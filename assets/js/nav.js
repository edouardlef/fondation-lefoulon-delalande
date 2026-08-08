/**
 * nav.js — Navigation latérale (sidebar)
 * - Desktop: width 72px collapsée → 280px au hover
 * - Mobile (<900px): overlay, bouton hamburger
 * - Sous-menus: toggle au clic
 * - Active: marque la page courante
 */

const Nav = (() => {
  let sidebar, overlay, hamburger, sidebarClose;

  function init() {
    sidebar     = document.getElementById('sidebar');
    overlay     = document.getElementById('sidebarOverlay');
    hamburger   = document.getElementById('menuToggle');
    sidebarClose = document.getElementById('sidebarClose');

    if (!sidebar) return;

    // Hamburger (mobile)
    if (hamburger) {
      hamburger.addEventListener('click', toggleSidebar);
    }
    // Bouton fermeture dans sidebar
    if (sidebarClose) {
      sidebarClose.addEventListener('click', closeSidebar);
    }
    // Clic overlay → ferme
    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }
    // Touche Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSidebar();
    });

    // Sous-menus (toggle au clic sur le lien parent)
    sidebar.querySelectorAll('.nav-item.has-sub > .nav-link').forEach(link => {
      link.addEventListener('click', e => {
        // Ne pas naviguer si le lien a un sous-menu
        const parent = link.parentElement;
        const isMobile = window.innerWidth <= 900;
        // En mobile ou sidebar expanded, toggle
        if (isMobile || sidebar.matches(':hover') || sidebar.classList.contains('is-open')) {
          e.preventDefault();
          toggleSubmenu(parent);
        }
      });
    });

    // Sur desktop hover : ouvre les sous-menus automatiquement
    sidebar.addEventListener('mouseenter', () => {
      // Ré-ouvre le sous-menu de la page active si existant
      const activeItem = sidebar.querySelector('.nav-item.active.has-sub');
      if (activeItem && !activeItem.classList.contains('submenu-open')) {
        activeItem.classList.add('submenu-open');
      }
    });

    // Active state
    markActive();

    // Resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeSidebar();
    });
  }

  function toggleSidebar() {
    const isOpen = sidebar.classList.contains('is-open');
    if (isOpen) closeSidebar();
    else openSidebar();
  }

  function openSidebar() {
    sidebar.classList.add('is-open');
    if (overlay) overlay.classList.add('active');
    if (hamburger) hamburger.classList.add('active');
    document.body.style.overflow = 'hidden';
    sidebar.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    if (overlay) overlay.classList.remove('active');
    if (hamburger) hamburger.classList.remove('active');
    document.body.style.overflow = '';
    sidebar.setAttribute('aria-expanded', 'false');
  }

  function toggleSubmenu(navItem) {
    const isOpen = navItem.classList.contains('submenu-open');
    // Ferme tous les autres
    sidebar.querySelectorAll('.nav-item.has-sub.submenu-open').forEach(item => {
      if (item !== navItem) item.classList.remove('submenu-open');
    });
    navItem.classList.toggle('submenu-open', !isOpen);
  }

  function markActive() {
    const current = location.pathname.replace(/\/$/, '').split('/').pop() || 'index';
    const currentFull = location.pathname;

    sidebar.querySelectorAll('.nav-link, .nav-submenu a').forEach(link => {
      const href = link.getAttribute('href') || '';
      const hrefPage = href.replace(/\/$/, '').split('/').pop() || 'index';

      let isActive = false;
      // Correspondance exacte ou basename
      if (href === './' || href === 'index.html') {
        isActive = current === '' || current === 'index';
      } else {
        isActive = hrefPage === current && hrefPage !== '';
      }

      if (isActive) {
        link.classList.add('active');
        // Remonte aux parents
        const navItem = link.closest('.nav-item');
        if (navItem) {
          navItem.classList.add('active');
          if (navItem.classList.contains('has-sub')) {
            navItem.classList.add('submenu-open');
          }
          // Parent si dans sous-menu
          const parentItem = navItem.closest('.nav-submenu')?.closest('.nav-item');
          if (parentItem) {
            parentItem.classList.add('active', 'submenu-open');
          }
        }
      }
    });
  }

  return { init, openSidebar, closeSidebar };
})();

export default Nav;
