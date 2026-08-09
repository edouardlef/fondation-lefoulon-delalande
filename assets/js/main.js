/**
 * main.js — Point d'entrée principal
 * Importe et initialise Nav + I18n
 * Charge les actualités et suggestions depuis JSON
 */

import I18n from './i18n.js';
import Nav  from './nav.js';

/* ── Initialisation ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await I18n.init();
  Nav.init();
  initAnimations();
  initHeroParallax();

  // Pages spécifiques
  if (document.getElementById('newsGrid'))        initNewsGrid();
  if (document.getElementById('suggestionsGrid')) initSuggestions();
  if (document.getElementById('heroNewsGrid'))    initHeroNews();
  if (document.getElementById('contactForm'))     initContactForm();
  if (document.getElementById('newsFilter'))      initNewsFilter();
  if (document.getElementById('articleContent'))  initArticlePage();

  // Clic sur une news-card : naviguer vers l'article
  document.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const card = e.target.closest('.news-card[data-slug]');
    if (!card) return;
    const base = document.documentElement.dataset.base || '';
    window.location.href = `${base}article.html#${card.dataset.slug}`;
  });

  // Mise à jour du contenu dynamique quand la langue change
  document.addEventListener('langChanged', ({ detail }) => {
    if (document.getElementById('newsGrid'))        renderNews(detail.translations);
    if (document.getElementById('suggestionsGrid')) renderSuggestions(detail.translations);
    if (document.getElementById('heroNewsGrid'))    renderHeroNews(detail.translations);
    if (document.getElementById('articleContent'))  rerenderArticlePage();
  });
});

/* ── Animations d'entrée ─────────────────────────────────────── */
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-in, .slide-up, .stat-item').forEach(el => observer.observe(el));

  // Compteur pour les stats
  document.querySelectorAll('.stat-number[data-count]').forEach(el => {
    observer.observe(el);
    el.addEventListener('animstart', () => animateCounter(el), { once: true });
  });
}

/* ── Parallax hero ──────────────────────────────────────────── */
function initHeroParallax() {
  const heroBg = document.querySelector('.hero-bg');
  if (!heroBg) return;
  heroBg.classList.add('loaded');

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        heroBg.style.transform = `translateY(${y * 0.3}px) scale(1)`;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ── Actualités (page d'accueil — 3 dernières) ─────────────── */
let _newsData = null;

async function fetchNews() {
  if (_newsData) return _newsData;
  try {
    const r = await fetch(window.FLD_DATA('actualites'));
    _newsData = await r.json();
    return _newsData;
  } catch (e) {
    console.warn('[main] Cannot load news:', e);
    return { actualites: [] };
  }
}

async function initHeroNews() {
  const data = await fetchNews();
  renderHeroNews(null, data);
}

function renderHeroNews(translations, data) {
  const container = document.getElementById('heroNewsGrid');
  if (!container) return;
  const t = translations || {};
  const lang = I18n.currentLang;

  fetchNews().then(d => {
    const items = d.actualites.slice(0, 3);
    container.innerHTML = items.map(item => newsCardHTML(item, lang, t, false)).join('');
  });
}

/* ── Actualités (page actualités — toutes) ──────────────────── */
async function initNewsGrid() {
  const data = await fetchNews();
  renderNews(null, data);
}

function renderNews(translations, data) {
  const container = document.getElementById('newsGrid');
  if (!container) return;
  const lang = I18n.currentLang;

  fetchNews().then(d => {
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.cat || 'all';
    const items = activeFilter === 'all'
      ? d.actualites
      : d.actualites.filter(a => a.categorie === activeFilter);

    if (items.length === 0) {
      container.innerHTML = `<p class="no-results text-muted">${I18n.t('news.no_news')}</p>`;
      return;
    }
    container.innerHTML = items.map((item, i) =>
      newsCardHTML(item, lang, null, i === 0 && activeFilter === 'all')
    ).join('');
  });
}

function newsCardHTML(item, lang, t, featured) {
  const titre  = item[`titre_${lang}`]  || item.titre_fr;
  const resume = item[`resume_${lang}`] || item.resume_fr;
  const date   = item[`date_${lang}`]   || item.date_fr;
  const readMore = I18n.t('news.read_more');

  const catMap = { prix: 'cat-prix', bourse: 'cat-bourse', appel: 'cat-appel', event: 'cat-event' };
  const catLabel = { prix: I18n.t('news_page.cat_prix'), bourse: I18n.t('news_page.cat_bourse'), appel: I18n.t('news_page.cat_appel'), event: I18n.t('news_page.cat_event') };
  const catClass = catMap[item.categorie] || '';
  const catText  = catLabel[item.categorie] || item.categorie;

  return `
    <article class="news-card${featured ? ' featured' : ''}" data-slug="${item.slug}">
      <div class="news-card-img">
        <img src="${item.image}" alt="${titre}" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="news-card-body">
        <div class="news-meta">
          <span class="news-category ${catClass}">${catText}</span>
          <time class="news-date">${date}</time>
        </div>
        <h3><a href="article.html#${item.slug}">${titre}</a></h3>
        <p>${resume}</p>
        <a href="article.html#${item.slug}" class="news-read-more">${readMore}</a>
      </div>
    </article>`;
}

/* ── Filtre des actualités ─────────────────────────────────── */
function initNewsFilter() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderNews();
    });
  });
}

/* ── Suggestions ────────────────────────────────────────────── */
let _suggestionsData = null;

async function fetchSuggestions() {
  if (_suggestionsData) return _suggestionsData;
  try {
    const r = await fetch(window.FLD_DATA('suggestions'));
    _suggestionsData = await r.json();
    return _suggestionsData;
  } catch (e) {
    return { suggestions: [] };
  }
}

async function initSuggestions() {
  await fetchSuggestions();
  renderSuggestions();
}

function renderSuggestions(translations) {
  const container = document.getElementById('suggestionsGrid');
  if (!container) return;
  const lang = I18n.currentLang;
  const icons = {
    flask:    `<svg viewBox="0 0 24 24"><path d="M9 3h6m-3 0v6l4 9H5l4-9V3"/></svg>`,
    heart:    `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    building: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 9h6M9 13h6M9 17h6"/></svg>`,
    award:    `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>`,
    activity: `<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    search:   `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    default:  `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
  };

  fetchSuggestions().then(d => {
    container.innerHTML = d.suggestions.map(s => {
      const titre = s[`titre_${lang}`] || s.titre_fr;
      const desc  = s[`desc_${lang}`]  || s.desc_fr;
      const label = s[`lien_label_${lang}`] || s.lien_label_fr;
      const icon  = icons[s.icon] || icons.default;
      return `
        <div class="suggestion-card slide-up">
          <div class="suggestion-icon">${icon}</div>
          <h4>${titre}</h4>
          <p>${desc}</p>
          <a href="${s.lien}" class="link" target="_blank" rel="noopener">
            ${label}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        </div>`;
    }).join('');

    // Ré-observ les nouvelles cartes
    document.querySelectorAll('.slide-up').forEach(el => {
      el.classList.remove('visible');
    });
    initAnimations();
  });
}

/* ── Formulaire de contact ──────────────────────────────────── */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '…';

    const payload = {
      nom:       form.nom?.value.trim()       || '',
      prenom:    form.prenom?.value.trim()    || '',
      email:     form.email?.value.trim()     || '',
      telephone: form.telephone?.value.trim() || '',
      objet:     form.objet?.value            || '',
      message:   form.message?.value.trim()   || '',
    };

    try {
      const api = window.FLD_API;
      if (api) {
        const r = await fetch(`${api}/api/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else {
        // Worker non configuré (API_BASE vide) → envoi simulé
        await new Promise(res => setTimeout(res, 800));
        console.warn('[contact] window.FLD_API non défini : envoi simulé.');
      }
      showFormSuccess(form);
    } catch (err) {
      console.error('[contact]', err);
      showFormError(form);
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}

function showFormError(form) {
  let box = form.querySelector('.form-error');
  if (!box) {
    box = document.createElement('p');
    box.className = 'form-error';
    box.setAttribute('role', 'alert');
    form.querySelector('.form-submit')?.appendChild(box);
  }
  box.textContent = I18n.t('contact.form_error')
    || "Une erreur est survenue. Merci de réessayer ou de nous écrire directement.";
}

function showFormSuccess(form) {
  const msg = document.createElement('div');
  msg.className = 'form-success';
  msg.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    <p>${I18n.t('contact.form_success') || 'Votre message a été envoyé avec succès. Nous vous répondrons dans les meilleurs délais.'}</p>`;
  form.replaceWith(msg);
}

/* ── Page article ───────────────────────────────────────────── */
let _currentArticle = null;
let _allArticles    = null;

async function initArticlePage() {
  const slug = location.hash.slice(1);
  if (!slug) {
    showArticleError('Article introuvable.');
    return;
  }

  const data = await fetchNews();
  _allArticles = data.actualites;
  _currentArticle = _allArticles.find(a => a.slug === slug) || null;

  if (!_currentArticle) {
    showArticleError('Article introuvable.');
    return;
  }
  renderArticle(_currentArticle, I18n.currentLang);
}

function rerenderArticlePage() {
  if (_currentArticle) renderArticle(_currentArticle, I18n.currentLang);
}

function renderArticle(item, lang) {
  const titre   = item[`titre_${lang}`]   || item.titre_fr;
  const resume  = item[`resume_${lang}`]  || item.resume_fr;
  const contenu = item[`contenu_${lang}`] || item.contenu_fr || `<p>${resume}</p>`;
  const date    = item[`date_${lang}`]    || item.date_fr;

  const catMap   = { prix: 'cat-prix', bourse: 'cat-bourse', appel: 'cat-appel', event: 'cat-event' };
  const catLabel = { prix: I18n.t('news_page.cat_prix'), bourse: I18n.t('news_page.cat_bourse'), appel: I18n.t('news_page.cat_appel'), event: I18n.t('news_page.cat_event') };
  const catClass = catMap[item.categorie] || '';
  const catText  = catLabel[item.categorie] || item.categorie;

  // <title> + meta
  document.title = `${titre} — Fondation Lefoulon-Delalande`;
  const metaDesc = document.getElementById('articleMetaDesc');
  if (metaDesc) metaDesc.setAttribute('content', resume);

  // Breadcrumb
  const bc = document.getElementById('articleBreadTitle');
  if (bc) bc.textContent = titre.length > 60 ? titre.slice(0, 60) + '…' : titre;

  // Hero image
  const heroWrap = document.getElementById('articleHeroWrap');
  if (heroWrap) {
    const heroSrc = item.image_full || item.image;
    heroWrap.innerHTML = heroSrc
      ? `<img class="article-hero-img" src="${heroSrc}" alt="${titre}">`
      : '';
  }

  // Page header
  const h1El = document.getElementById('articleH1');
  if (h1El) h1El.textContent = titre;

  const headerMeta = document.getElementById('articleHeaderMeta');
  if (headerMeta) {
    headerMeta.innerHTML = `
      <span class="news-category ${catClass}">${catText}</span>
      <time class="news-date">${date}</time>
      ${item.auteur ? `<span class="article-author">${I18n.t('article.by')} ${item.auteur}</span>` : ''}`;
  }

  // Contenu principal
  const contentEl = document.getElementById('articleContent');
  if (contentEl) {
    const tagsHTML = (item.tags || []).map(t =>
      `<span class="article-tag">${t}</span>`
    ).join('');

    contentEl.innerHTML = `
      <div class="article-body">${contenu}</div>
      ${tagsHTML ? `<div class="article-tags">${tagsHTML}</div>` : ''}
      <div class="article-external-link">
        <a href="${item.url}" class="btn btn-outline" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          ${I18n.t('article.read_official') || 'Lire sur le site officiel'}
        </a>
      </div>`;
  }

  // Sidebar méta
  const metaCard = document.getElementById('articleMetaCard');
  if (metaCard) {
    metaCard.innerHTML = `
      <h4 data-i18n="article.about">${I18n.t('article.about') || 'À propos de cet article'}</h4>
      <ul class="article-meta-list">
        <li>
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>${date}</span>
        </li>
        <li>
          <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          <span>${catText}</span>
        </li>
        ${item.auteur ? `<li>
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>${item.auteur}</span>
        </li>` : ''}
      </ul>
      <a href="actualites.html" class="article-meta-back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        ${I18n.t('article.back_to_news') || 'Toutes les actualités'}
      </a>`;
  }

  // Navigation précédent / suivant
  if (_allArticles && _allArticles.length > 1) {
    const idx  = _allArticles.findIndex(a => a.slug === item.slug);
    const prev = _allArticles[idx - 1] || null;
    const next = _allArticles[idx + 1] || null;
    const navEl = document.getElementById('articleNav');
    if (navEl) {
      navEl.style.display = 'flex';
      const prevEl = document.getElementById('articleNavPrev');
      const nextEl = document.getElementById('articleNavNext');
      if (prev && prevEl) {
        prevEl.href = `article.html#${prev.slug}`;
        const prevTitle = document.getElementById('articleNavPrevTitle');
        if (prevTitle) prevTitle.textContent = prev[`titre_${lang}`] || prev.titre_fr;
        prevEl.style.display = 'flex';
      } else if (prevEl) { prevEl.style.display = 'none'; }
      if (next && nextEl) {
        nextEl.href = `article.html#${next.slug}`;
        const nextTitle = document.getElementById('articleNavNextTitle');
        if (nextTitle) nextTitle.textContent = next[`titre_${lang}`] || next.titre_fr;
        nextEl.style.display = 'flex';
      } else if (nextEl) { nextEl.style.display = 'none'; }
    }
  }

  // Articles liés (même catégorie, max 3)
  const relatedSection = document.getElementById('articleRelated');
  const relatedGrid    = document.getElementById('articleRelatedGrid');
  if (relatedSection && relatedGrid && _allArticles) {
    const related = _allArticles
      .filter(a => a.slug !== item.slug && a.categorie === item.categorie)
      .slice(0, 3);

    const fallback = related.length < 3
      ? _allArticles.filter(a => a.slug !== item.slug && related.indexOf(a) === -1).slice(0, 3 - related.length)
      : [];

    const toShow = [...related, ...fallback].slice(0, 3);
    if (toShow.length) {
      relatedSection.style.display = 'block';
      relatedGrid.innerHTML = toShow.map(r => newsCardHTML(r, lang, null, false)).join('');
    }
  }
}

function showArticleError(msg) {
  const contentEl = document.getElementById('articleContent');
  if (contentEl) contentEl.innerHTML = `<p class="no-results text-muted">${msg}</p>`;
  const heroWrap = document.getElementById('articleHeroWrap');
  if (heroWrap) heroWrap.innerHTML = '';
}

/* ── Animations CSS helpers ─────────────────────────────────── */
(function addAnimStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .fade-in  { opacity: 0; transition: opacity .6s ease; }
    .slide-up { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease; }
    .fade-in.visible, .slide-up.visible { opacity: 1; transform: none; }
    .stat-item { opacity: 0; transform: translateY(16px); transition: opacity .5s ease, transform .5s ease; }
    .stat-item.visible { opacity: 1; transform: none; }
    .form-success { text-align:center; padding:48px 24px; color: var(--navy); }
    .form-success svg { margin: 0 auto 16px; color: var(--blue); }
    .form-success p { font-size:1rem; color: var(--text-muted); }
    .no-results { padding: 32px 0; text-align: center; }
  `;
  document.head.appendChild(s);
})();
