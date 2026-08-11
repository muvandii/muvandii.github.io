/**
 * Landing page behavior: renders the project grid from each project's
 * GitHub documentation, plus scroll-reveal and header interactions.
 */
(function () {
  'use strict';

  var P = window.MuvandiiPortfolio;
  if (!P) return;

  document.addEventListener('DOMContentLoaded', function () {
    P.initHeader();

    // Footer year
    var yearEl = document.getElementById('footerYear');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    // Project grid — replaces the static no-JS fallback cards
    var grid = document.getElementById('projectsGrid');
    if (grid) {
      P.loadRegistry().then(function (registry) {
        return P.renderProjectGrid(grid, registry, {
          onRendered: function (container) {
            // reveal cards as they appear (staggered)
            var cards = container.querySelectorAll('.project-card');
            cards.forEach(function (card, i) {
              card.style.setProperty('--reveal-delay', Math.min(i * 70, 420) + 'ms');
              card.classList.add('reveal', 'in-view');
            });
          }
        });
      }).catch(function (err) {
        console.error('Failed to load project registry:', err);
        grid.innerHTML =
          '<div class="panel" style="grid-column: 1 / -1">' +
            '<div class="panel__icon" aria-hidden="true">⚠️</div>' +
            '<h3 class="panel__title">Could not load projects</h3>' +
            '<p class="panel__text">The project registry (assets/data/projects.json) could not be loaded. Check that the file exists and is valid JSON.</p>' +
          '</div>';
      });
    }

    // Scroll-reveal for static sections
    var revealEls = document.querySelectorAll('.reveal:not(.in-view)');
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach(function (el) { observer.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('in-view'); });
    }

    console.log('%c👋 Hello! Thanks for checking out Muvandii\'s portfolio.',
      'color: #2563EB; font-size: 1.1rem; font-weight: bold;');
    console.log('%cProject cards load live from each project repository\'s documentation/ folder.',
      'color: #475569; font-size: 0.9rem;');
    console.log('%c📊 Excel • Power Query • Power BI', 'color: #F2C811; font-weight: 600;');
  });
})();
