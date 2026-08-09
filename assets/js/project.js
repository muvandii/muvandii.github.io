/**
 * Project case-study page (project.html?id=...)
 * Renders, from the project's GitHub repository:
 *   - project.md  -> hero (frontmatter) + full case study body
 *   - modules.md  -> module-by-module documentation with navigation
 */
(function () {
  'use strict';

  var P = window.MuvandiiPortfolio;
  if (!P) return;

  var SITE_URL = 'https://muvandii.github.io';
  var SETUP_GUIDE_URL = 'https://github.com/muvandii/muvandii.github.io/blob/main/README.md#how-to-add-a-new-project';

  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function escapeAttr(s) { return P.escapeHtml(s); }

  /* ------------------------------------------------------------------
   * SEO helpers
   * ------------------------------------------------------------------ */
  function absoluteUrl(path) {
    if (/^https?:/i.test(path)) return path;
    return SITE_URL + '/' + String(path).replace(/^\/+/, '');
  }

  function updateSeo(project, meta) {
    var title = (meta && meta.title) || project.title || project.id;
    var summary = (meta && meta.summary) || project.summary || '';
    var cover = meta ? P.mediaUrl(project, P.normalizeCoverPath(meta.cover)) : '';
    var pageUrl = SITE_URL + '/project.html?id=' + encodeURIComponent(project.id);
    var category = (meta && meta.category) || '';

    document.title = title + ' — Muvandii Portfolio';
    setMeta('description', summary || 'In-depth project case study by Muvandii — Data Analyst.');
    setMeta('og:title', title + (category ? ' | ' + category : ''));
    setMeta('og:description', summary);
    setMeta('og:image', absoluteUrl(cover));
    setMeta('og:url', pageUrl);
    setMeta('twitter:title', title);
    setMeta('twitter:description', summary);

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', pageUrl);

    var ld = document.getElementById('project-ld');
    if (ld) ld.remove();
    ld = document.createElement('script');
    ld.id = 'project-ld';
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      'name': title,
      'description': summary,
      'url': pageUrl,
      'image': absoluteUrl(cover),
      'author': { '@type': 'Person', 'name': 'Muvandii', 'url': SITE_URL },
      'codeRepository': P.repoUrl(project)
    });
    document.head.appendChild(ld);
  }

  function setMeta(attr, value) {
    if (!value) return;
    var el = document.querySelector('meta[property="' + attr + '"]') ||
             document.querySelector('meta[name="' + attr + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr.indexOf(':') > -1 ? 'property' : 'name', attr);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  /* ------------------------------------------------------------------
   * Hero
   * ------------------------------------------------------------------ */
  function renderHero(project, meta) {
    var badges = document.getElementById('caseHeroBadges');
    var titleEl = document.getElementById('caseTitle');
    var summaryEl = document.getElementById('caseSummary');
    var toolsEl = document.getElementById('caseTools');
    var actionsEl = document.getElementById('caseActions');
    var coverEl = document.getElementById('caseHeroCover');
    var breadcrumbEl = document.getElementById('breadcrumbCurrent');

    var title = (meta && meta.title) || project.title || project.repo || project.id;
    var summary = (meta && meta.summary) || project.summary || '';
    var category = (meta && meta.category) || project.category || '';
    var techs = (meta && meta.technologies) || project.technologies || [];

    if (breadcrumbEl) breadcrumbEl.textContent = title;

    if (badges) {
      var html = '';
      if (category) html += '<span class="case-hero__category">' + escapeAttr(category) + '</span>';
      if (project.demo) html += '<span class="case-hero__demo">Template Demo</span>';
      badges.innerHTML = html;
    }
    if (titleEl) titleEl.textContent = title;
    if (summaryEl) summaryEl.textContent = summary || 'No summary provided.';
    if (toolsEl) {
      toolsEl.innerHTML = techs.slice(0, 8).map(function (t) {
        return '<span class="tool-tag">' + escapeAttr(t) + '</span>';
      }).join('');
    }
    if (actionsEl) {
      actionsEl.innerHTML =
        '<a class="btn btn--light" href="' + escapeAttr(P.repoUrl(project)) + '" target="_blank" rel="noopener noreferrer">' +
          '<svg class="btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>' +
          'View on GitHub</a>' +
        '<a class="btn btn--outline-light" href="' + escapeAttr(P.repoDocsUrl(project)) + '" target="_blank" rel="noopener noreferrer">' +
          'Documentation on GitHub</a>';
    }
    if (coverEl && meta) {
      var coverPath = P.normalizeCoverPath(meta.cover);
      var coverUrl = P.mediaUrl(project, coverPath);
      var placeholder = 'assets/img/placeholder.svg';
      coverEl.innerHTML =
        '<div class="case-hero__cover-frame">' +
          '<img class="case-hero__cover" src="' + escapeAttr(coverUrl) + '" alt="' + escapeAttr(title) + ' cover image"' +
            ' data-candidates="' + escapeAttr(JSON.stringify([coverUrl, placeholder])) + '"' +
            ' loading="eager" decoding="async">' +
          '<span class="case-hero__cover-caption">' + escapeAttr(coverPath) + ' · ' + escapeAttr(project.repo || 'template') + '</span>' +
        '</div>';
      P.bindImageFallbacks(coverEl);
    }
  }

  /* ------------------------------------------------------------------
   * Sub navigation + TOC
   * ------------------------------------------------------------------ */
  function buildNav(headings, hasModules, project) {
    var subnav = document.getElementById('subnav');
    var toc = document.getElementById('caseToc');
    if (!subnav) return;

    var items = [];
    if (headings.length) {
      items.push({ id: headings[0].id, label: 'Overview', spy: headings[0].id });
      for (var i = 1; i < headings.length; i++) {
        items.push({ id: headings[i].id, label: headings[i].label, spy: headings[i].id });
      }
    }
    if (hasModules) items.push({ id: 'modules', label: 'Modules', spy: 'modules' });
    items.push({ id: 'repo', label: 'GitHub', spy: null, href: P.repoUrl(project) });

    var subnavHtml = items.map(function (item) {
      if (item.href) {
        return '<a class="subnav__link" href="' + escapeAttr(item.href) + '" target="_blank" rel="noopener noreferrer">' +
          escapeAttr(item.label) + '</a>';
      }
      return '<a class="subnav__link" href="#' + escapeAttr(item.id) + '" data-spy="' + escapeAttr(item.spy) + '">' +
        escapeAttr(item.label) + '</a>';
    }).join('');
    subnav.innerHTML = subnavHtml;

    if (toc && headings.length) {
      toc.innerHTML =
        '<p class="case-toc__label">On this page</p>' +
        '<ul class="case-toc__list">' +
        headings.map(function (h) {
          return '<li><a class="case-toc__link" href="#' + escapeAttr(h.id) + '" data-spy="' + escapeAttr(h.id) + '">' +
            escapeAttr(h.label) + '</a></li>';
        }).join('') +
        '</ul>';
    }
  }

  /* ------------------------------------------------------------------
   * Modules
   * ------------------------------------------------------------------ */
  var SECTION_ICONS = {
    'purpose': '🎯', 'input': '📥', 'requirements': '📋', 'process': '⚙️',
    'implementation': '💻', 'output': '📤', 'validation': '✅', 'evidence': '📸',
    'challenges': '⚠️', 'solution': '🔧', 'results': '📊', 'lessons learned': '💡'
  };

  function sectionIcon(title) {
    var key = String(title || '').toLowerCase();
    return SECTION_ICONS[key] || '📄';
  }

  function renderModules(project, mdText) {
    var container = document.getElementById('modulesSection');
    if (!container) return null;
    if (!mdText || !mdText.trim()) {
      container.innerHTML = '';
      return null;
    }

    var parsed;
    try {
      parsed = P.splitModules(mdText, project);
    } catch (e) {
      console.error('Failed to parse modules.md:', e);
      container.innerHTML = '';
      return null;
    }
    if (!parsed.modules.length) {
      container.innerHTML =
        '<div class="panel" style="margin-top:2rem">' +
          '<div class="panel__icon" aria-hidden="true">📄</div>' +
          '<h3 class="panel__title">No modules found</h3>' +
          '<p class="panel__text"><code>documentation/modules.md</code> exists but contains no <code>## Module</code> headings.</p>' +
        '</div>';
      return null;
    }

    var navLinks = parsed.modules.map(function (m, i) {
      return '<a class="modules-nav__link" href="#' + escapeAttr(m.id) + '" data-spy="' + escapeAttr(m.id) + '">' +
        '<span class="mnum">' + String(i + 1).padStart(2, '0') + '</span>' + escapeAttr(m.title) + '</a>';
    }).join('');

    var modulesHtml = parsed.modules.map(function (m, i) {
      var sectionsHtml = m.sections.map(function (s) {
        var isEvidence = /evidence/i.test(s.title);
        return '<section class="module__section' + (isEvidence ? ' module__section--full' : '') + '"' +
          ' id="' + escapeAttr(m.id) + '-' + escapeAttr(s.id) + '" data-title="' + escapeAttr(s.title) + '">' +
          '<h4 class="module__section-title"><span class="module__section-icon" aria-hidden="true">' +
          sectionIcon(s.title) + '</span>' + escapeAttr(s.title) + '</h4>' +
          '<div class="module__section-body">' + s.html + '</div>' +
        '</section>';
      }).join('');

      var pager = '';
      if (parsed.modules.length > 1) {
        var prev = parsed.modules[i - 1];
        var next = parsed.modules[i + 1];
        pager = '<div class="module-pager">' +
          (prev
            ? '<a class="module-pager__link module-pager__link--prev" href="#' + escapeAttr(prev.id) + '">' +
                '<span class="module-pager__dir">&larr; Previous</span>' +
                '<span class="module-pager__name">' + escapeAttr(prev.title) + '</span>' +
              '</a>'
            : '<span></span>') +
          (next
            ? '<a class="module-pager__link module-pager__link--next" href="#' + escapeAttr(next.id) + '">' +
                '<span class="module-pager__dir">Next &rarr;</span>' +
                '<span class="module-pager__name">' + escapeAttr(next.title) + '</span>' +
              '</a>'
            : '') +
        '</div>';
      }

      return (
        '<article class="module" id="' + escapeAttr(m.id) + '">' +
          '<header class="module__header">' +
            '<span class="module__number" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<h3 class="module__title"><a href="#' + escapeAttr(m.id) + '">' + escapeAttr(m.title) + '</a></h3>' +
          '</header>' +
          '<div class="module__body">' +
            (m.introHtml ? '<div class="module__intro">' + m.introHtml + '</div>' : '') +
            (sectionsHtml ? '<div class="module__sections">' + sectionsHtml + '</div>' : '<p class="module__intro">No sections defined for this module yet.</p>') +
          '</div>' +
          pager +
        '</article>'
      );
    }).join('');

    container.innerHTML =
      '<div class="modules-section" id="modules">' +
        '<div class="modules-section__header">' +
          '<h2 class="modules-section__title" id="modules-heading">Modules</h2>' +
          '<span class="modules-section__hint">' + parsed.modules.length + ' module' + (parsed.modules.length > 1 ? 's' : '') +
          ' · generated from documentation/modules.md</span>' +
        '</div>' +
        '<div class="modules-layout">' +
          '<nav class="modules-nav" aria-label="Project modules">' +
            '<p class="modules-nav__label">Modules</p>' +
            '<ul class="modules-nav__list">' + navLinks + '</ul>' +
          '</nav>' +
          '<div class="modules-list">' + modulesHtml + '</div>' +
        '</div>' +
      '</div>';

    P.bindImageFallbacks(container);
    return parsed.modules;
  }

  /* ------------------------------------------------------------------
   * Related projects
   * ------------------------------------------------------------------ */
  function renderRelated(registry, currentProject) {
    var container = document.getElementById('relatedSection');
    if (!container) return;
    var others = registry.projects.filter(function (p) {
      return p.id !== currentProject.id && !p.demo;
    });
    if (!others.length) return;

    Promise.all(others.map(function (p) { return P.loadProjectMeta(p); }))
      .then(function (results) {
        var ok = results.filter(function (r) { return r.status === 'ok'; }).slice(0, 3);
        if (!ok.length) return;
        var cards = ok.map(function (r) {
          var meta = r.meta;
          var p = r.project;
          var title = meta.title || p.title || p.repo;
          var category = meta.category || p.category || '';
          var cover = P.mediaUrl(p, P.normalizeCoverPath(meta.cover));
          return '<a class="related-card" href="project.html?id=' + encodeURIComponent(p.id) + '">' +
            '<img class="related-card__cover" src="' + escapeAttr(cover) + '" alt="" loading="lazy" decoding="async">' +
            '<span><span class="related-card__title">' + escapeAttr(title) + '</span>' +
            (category ? '<span class="related-card__cat">' + escapeAttr(category) + '</span>' : '') +
            '</span></a>';
        }).join('');
        container.innerHTML =
          '<div class="related">' +
            '<h2 class="related__title">More Projects</h2>' +
            '<div class="related__grid">' + cards + '</div>' +
          '</div>';
        P.bindImageFallbacks(container);
      });
  }

  /* ------------------------------------------------------------------
   * States: loading / missing / error / not found
   * ------------------------------------------------------------------ */
  function showPanel(icon, title, text, actionHtml) {
    var status = document.getElementById('caseStatus');
    var body = document.getElementById('caseBody');
    if (body) body.innerHTML = '';
    if (!status) return;
    status.innerHTML =
      '<div class="panel">' +
        '<div class="panel__icon" aria-hidden="true">' + icon + '</div>' +
        '<h3 class="panel__title">' + escapeAttr(title) + '</h3>' +
        '<p class="panel__text">' + text + '</p>' +
        (actionHtml || '') +
      '</div>';
  }

  function renderUnpublished(project, res) {
    if (res.status === 'missing') {
      showPanel(
        '🕒',
        'Documentation not published yet',
        'This card appears automatically once the repository is live. Expected documentation at ' +
          '<code>documentation/project.md</code> and <code>documentation/modules.md</code> in the repository ' +
          '<code>' + escapeAttr(project.owner + '/' + project.repo) + '</code> — no changes needed here.',
        '<a class="btn btn--primary btn--sm" href="' + escapeAttr(SETUP_GUIDE_URL) + '" target="_blank" rel="noopener noreferrer">How to publish a project</a>'
      );
    } else {
      showPanel(
        '📡',
        'Could not load documentation',
        'The repository could not be reached. Check your internet connection or open the repository directly.',
        '<a class="btn btn--primary btn--sm" href="' + escapeAttr(P.repoUrl(project)) + '" target="_blank" rel="noopener noreferrer">Open Repository on GitHub</a>' +
        '<button class="btn btn--secondary btn--sm" onclick="location.reload()">Retry</button>'
      );
    }
  }

  function renderNotFound() {
    showPanel(
      '🔍',
      'Project not found',
      'No project matches that id in the portfolio registry.',
      '<a class="btn btn--primary btn--sm" href="index.html#projects">Back to Projects</a>'
    );
  }

  /* ------------------------------------------------------------------
   * Scroll spy
   * ------------------------------------------------------------------ */
  function setupScrollSpy() {
    var spyLinks = Array.prototype.slice.call(document.querySelectorAll('[data-spy]'));
    if (!spyLinks.length) return;
    var targets = spyLinks.map(function (link) {
      return document.getElementById(link.getAttribute('data-spy'));
    }).filter(Boolean);

    var ticking = false;
    function update() {
      ticking = false;
      var offset = 130; // header + subnav
      var current = null;
      targets.forEach(function (el) {
        if (el.getBoundingClientRect().top <= offset) current = el;
      });
      var currentId = current ? current.id : null;
      spyLinks.forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('data-spy') === currentId);
      });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    P.initHeader();
    var yearEl = document.getElementById('footerYear');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    var id = getParam('id');
    if (!id) {
      window.location.replace('index.html#projects');
      return;
    }

    P.loadRegistry().then(function (registry) {
      var project = registry.projects.filter(function (p) { return p.id === id; })[0];
      if (!project) { renderNotFound(); return; }

      // fetch both documentation files in parallel
      return Promise.all([P.loadProjectMeta(project), P.fetchDoc(project, 'modules.md')])
        .then(function (results) {
          var metaRes = results[0];
          var modulesRes = results[1];

          if (metaRes.status !== 'ok') {
            renderUnpublished(project, metaRes);
            return;
          }

          renderHero(project, metaRes.meta);
          updateSeo(project, metaRes.meta);

          var bodyEl = document.getElementById('caseBody');
          var html = P.renderMarkdown(metaRes.body, project);
          bodyEl.innerHTML = html;
          P.bindImageFallbacks(bodyEl);

          // collect h2 headings for TOC / subnav
          var headings = Array.prototype.slice.call(bodyEl.querySelectorAll('h2')).map(function (h) {
            return { id: h.id, label: h.textContent.replace(/#/g, '').trim() };
          }).filter(function (h) { return h.id; });

          var modules = renderModules(project, modulesRes.status === 'ok' ? modulesRes.text : null);
          if (modulesRes.status === 'missing') {
            var mSec = document.getElementById('modulesSection');
            if (mSec) mSec.innerHTML = '';
          }

          buildNav(headings, !!(modules && modules.length), project);
          setupScrollSpy();
          renderRelated(registry, project);
        });
    }).catch(function (err) {
      console.error(err);
      showPanel('⚠️', 'Something went wrong', 'The portfolio could not load this project. Please try again.',
        '<button class="btn btn--primary btn--sm" onclick="location.reload()">Retry</button>');
    });
  });
})();
