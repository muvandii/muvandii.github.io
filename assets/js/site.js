/**
 * Muvandii Portfolio — core library
 * ------------------------------------------------------------------
 * Loads Markdown documentation from each project's GitHub repository
 * and renders it on the static (GitHub Pages) site.
 *
 * How it works:
 *  1. A small registry (assets/data/projects.json) maps each project
 *     to its GitHub repository (owner / repo / branch). It contains
 *     ONLY locator information — no duplicated content.
 *  2. All visible content (title, summary, cover, technologies, body)
 *     is fetched at runtime from the repository:
 *       https://raw.githubusercontent.com/{owner}/{repo}/{branch}/documentation/project.md
 *       https://raw.githubusercontent.com/{owner}/{repo}/{branch}/documentation/modules.md
 *  3. YAML frontmatter at the top of project.md provides metadata.
 *  4. Relative image paths in the Markdown are resolved with the same
 *     semantics GitHub uses (relative to the documentation/ folder),
 *     so ../images/foo.png  ->  {repo-root}/images/foo.png
 *
 * The library works both in the browser (window.MuvandiiPortfolio)
 * and in Node.js (module.exports) so the pure logic can be unit tested.
 */
(function (global) {
  'use strict';

  /* ================================================================
   * Constants & environment
   * ================================================================ */

  var RAW_BASE = 'https://raw.githubusercontent.com';
  var DOC_DIR = 'documentation'; // folder inside each project repo
  var CACHE_PREFIX = 'muvandii-pf:';
  var CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  var hasLocalStorage = (function () {
    try {
      return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch (e) {
      return false;
    }
  })();

  var hasDOMPurify = function () { return typeof global.DOMPurify !== 'undefined'; };
  var hasMarked = function () { return typeof global.marked !== 'undefined'; };

  /* ================================================================
   * Small utilities
   * ================================================================ */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // strip punctuation (keeps unicode out)
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /** Returns a function that produces unique slugs within one document. */
  function makeSlugCounter() {
    var used = {};
    return function (text) {
      var base = slugify(text) || 'section';
      var slug = base;
      var n = 2;
      while (used[slug]) {
        slug = base + '-' + n;
        n += 1;
      }
      used[slug] = true;
      return slug;
    };
  }

  /** Read a JSON value from cache (best-effort). */
  function cacheGet(key) {
    if (!hasLocalStorage) return null;
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (!entry || !entry.t || !entry.v) return null;
      if (Date.now() - entry.t > CACHE_TTL) return null;
      return entry.v;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(key, value) {
    if (!hasLocalStorage) return;
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
    } catch (e) {
      /* storage full / private mode — ignore */
    }
  }

  /* ================================================================
   * Frontmatter parsing (YAML subset used by project.md)
   * ================================================================ */

  /**
   * Parses a Markdown document that may start with a YAML frontmatter
   * block (--- ... ---). Returns { meta, body }.
   * Supports the subset used by the template:
   *   key: value
   *   key: "quoted value"
   *   key:
   *     - item one
   *     - item two
   *   key: [a, b, c]
   */
  function parseFrontmatter(text) {
    var meta = {};
    var body = String(text || '');
    var cleaned = body.replace(/^\uFEFF/, ''); // strip BOM

    if (!/^---\s*(\r?\n|$)/.test(cleaned)) {
      return { meta: meta, body: cleaned };
    }

    var lines = cleaned.split(/\r?\n/);
    var end = -1;
    for (var i = 1; i < lines.length; i++) {
      if (/^---\s*$/.test(lines[i])) {
        end = i;
        break;
      }
    }
    if (end === -1) return { meta: meta, body: cleaned };

    var fm = lines.slice(1, end);
    var currentKey = null;

    for (var j = 0; j < fm.length; j++) {
      var line = fm[j];
      var listMatch = line.match(/^\s*-\s+(.*)$/);
      if (listMatch && currentKey) {
        var item = listMatch[1].trim().replace(/^["']|["']$/g, '');
        if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
        meta[currentKey].push(item);
        continue;
      }
      currentKey = null;
      var kv = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!kv) continue;
      var key = kv[1];
      var value = kv[2].trim();
      if (value === '') {
        currentKey = key;
        meta[key] = [];
        continue;
      }
      // inline list: [a, b, c]
      if (/^\[.*\]$/.test(value)) {
        meta[key] = value
          .slice(1, -1)
          .split(',')
          .map(function (s) { return s.trim().replace(/^["']|["']$/g, ''); })
          .filter(Boolean);
        continue;
      }
      // booleans / numbers
      if (value === 'true') { meta[key] = true; continue; }
      if (value === 'false') { meta[key] = false; continue; }
      var num = Number(value);
      meta[key] = (value !== '' && !isNaN(num)) ? num : value.replace(/^["']|["']$/g, '');
    }

    var bodyStart = end + 1;
    // skip a blank line right after the closing ---
    while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++;
    return { meta: meta, body: lines.slice(bodyStart).join('\n') };
  }

  /* ================================================================
   * Path resolution (GitHub relative-link semantics)
   * ================================================================ */

  /** Normalizes a/b/../c paths -> a/c (no filesystem access). */
  function normalizePath(path) {
    var parts = String(path).split('/');
    var stack = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === '' || part === '.') continue;
      if (part === '..') {
        if (stack.length) stack.pop();
        continue;
      }
      stack.push(part);
    }
    return stack.join('/');
  }

  /**
   * Resolves a reference found inside a Markdown file, using the same
   * rules GitHub uses: relative refs are resolved against the folder
   * that contains the Markdown file (documentation/).
   * Returns a repo-root-relative path.
   */
  function resolveRelative(fromDir, ref) {
    var href = String(ref || '').trim();
    if (/^https?:\/\//i.test(href)) return href;
    if (/^\/\//.test(href)) return 'https:' + href;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href; // other schemes (mailto: etc.)
    if (href.indexOf('#') === 0) return href; // in-page anchor
    if (/^\//.test(href)) return normalizePath(href); // repo-root absolute
    return normalizePath(fromDir + '/' + href);
  }

  /**
   * Candidate repo-root-relative paths for a media reference found in
   * the documentation. The first is GitHub's exact semantics; extra
   * candidates cover the common "images/foo.png" shortcut written from
   * documentation/ (which GitHub itself would resolve to
   * documentation/images/foo.png — we also try the repo-root images/).
   */
  function mediaCandidates(ref) {
    var resolved = resolveRelative(DOC_DIR, ref);
    if (/^https?:/i.test(resolved) || resolved.indexOf('#') === 0) return [resolved];
    var candidates = [resolved];
    if (resolved.indexOf(DOC_DIR + '/') === 0) {
      candidates.push(resolved.slice(DOC_DIR.length + 1));
    }
    // de-duplicate
    return candidates.filter(function (c, i) { return candidates.indexOf(c) === i; });
  }

  /** Normalizes a frontmatter cover path (relative to repo root). */
  function normalizeCoverPath(path) {
    if (!path) return 'images/cover.png';
    var p = String(path).trim();
    if (/^https?:/i.test(p)) return p;
    while (p.indexOf('../') === 0) p = p.slice(3);
    return p.replace(/^\/+/, '');
  }

  /* ================================================================
   * Project sources (raw GitHub <-> local demo)
   * ================================================================ */

  /** Base URL/path that acts as the "repository root" for a project. */
  function mediaRoot(project) {
    if (project.localRoot) return project.localRoot;
    return RAW_BASE + '/' + project.owner + '/' + project.repo + '/' + project.branch;
  }

  function docsDir(project) {
    return project.docsDir || DOC_DIR;
  }

  /** Full URL of a Markdown documentation file. */
  function docUrl(project, file) {
    return mediaRoot(project) + '/' + docsDir(project) + '/' + file;
  }

  /** Full URL of a repo-root-relative media file (cover, screenshots…). */
  function mediaUrl(project, repoRootPath) {
    if (/^https?:/i.test(repoRootPath)) return repoRootPath;
    return mediaRoot(project) + '/' + repoRootPath;
  }

  /** GitHub web URL of the repository (used for buttons/links). */
  function repoUrl(project) {
    if (project.localRoot) return 'https://github.com/muvandii/muvandii.github.io';
    return 'https://github.com/' + project.owner + '/' + project.repo;
  }

  function repoDocsUrl(project) {
    if (project.localRoot) return repoUrl(project) + '/tree/main/templates/project-repository/documentation';
    return repoUrl(project) + '/tree/' + project.branch + '/' + docsDir(project);
  }

  /* ================================================================
   * Fetching documentation
   * ================================================================ */

  /**
   * Fetches a documentation file.
   * Returns { status: 'ok', text } | { status: 'missing' } | { status: 'error' }
   */
  function fetchDoc(project, file) {
    var url = docUrl(project, file);
    var cacheKey = project.localRoot
      ? null
      : (project.owner + '/' + project.repo + '/' + project.branch + '/' + file);

    if (cacheKey) {
      var cached = cacheGet(cacheKey);
      if (cached !== null) {
        return Promise.resolve({ status: 'ok', text: cached, cached: true });
      }
    }

    return fetch(url, { method: 'GET' }).then(function (res) {
      if (res.status === 404 || res.status === 410) {
        return { status: 'missing', url: url };
      }
      if (!res.ok) {
        return { status: 'error', url: url, code: res.status };
      }
      return res.text().then(function (text) {
        if (cacheKey) cacheSet(cacheKey, text);
        return { status: 'ok', text: text, cached: false };
      });
    }).catch(function (err) {
      return { status: 'error', url: url, error: err };
    });
  }

  /**
   * Normalizes a raw registry object.
   *
   * The registry declares `owner` and `defaultBranch` ONCE at the top
   * level; individual project entries usually omit them. Every consumer
   * (mediaRoot, docUrl, repoUrl, cache keys, the "expected repository"
   * notice) reads `project.owner` / `project.branch` directly, so those
   * top-level defaults must be pushed down onto each project here —
   * otherwise the raw URL becomes
   *   https://raw.githubusercontent.com/undefined/<repo>/main/...
   * which 404s and makes every project render as "not published yet".
   *
   * Also fills the `id` (defaults to the repo name) so a registry entry
   * can be added with nothing but a `repo`.
   */
  function normalizeRegistry(registry) {
    var reg = registry || {};
    var owner = reg.owner || '';
    var defaultBranch = reg.defaultBranch || 'main';
    var projects = Array.isArray(reg.projects) ? reg.projects : [];

    var normalized = projects.map(function (raw) {
      var p = {};
      for (var k in raw) {
        if (Object.prototype.hasOwnProperty.call(raw, k)) p[k] = raw[k];
      }
      // Local/demo projects are served from this repository — no owner needed.
      if (!p.localRoot) {
        if (!p.owner) p.owner = owner;
        if (!p.branch) p.branch = defaultBranch;
        if (!p.id) p.id = p.repo;
      } else if (!p.id) {
        p.id = slugify(p.localRoot);
      }
      return p;
    }).filter(function (p) {
      var usable = !!p.localRoot || (!!p.owner && !!p.repo);
      if (!usable && typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[portfolio] Skipping registry entry without a resolvable source. ' +
          'Each project needs either "repo" (plus a top-level "owner") or "localRoot".',
          p
        );
      }
      return usable;
    });

    return {
      owner: owner,
      defaultBranch: defaultBranch,
      projects: normalized
    };
  }

  /** Loads the registry file. */
  function loadRegistry() {
    return fetch('assets/data/projects.json', { method: 'GET' }).then(function (res) {
      if (!res.ok) throw new Error('Failed to load project registry (' + res.status + ')');
      return res.json();
    }).then(normalizeRegistry);
  }

  /**
   * Fetches project.md for a project and returns frontmatter + parsed body.
   * Resolves to { status, project, meta, body, raw } — or a status-only
   * object when the file is missing/unreachable.
   */
  /**
   * Derives metadata from the Markdown body for documents that have no
   * (or incomplete) YAML frontmatter — a very common case when an
   * existing project.md is dropped into the repository as-is.
   *
   *  - `title`   <- the first level-1 heading, otherwise the first heading
   *  - `summary` <- the first real paragraph after that heading
   *
   * When the title comes from a leading H1, that heading is removed from
   * the body so the case-study page does not print the title twice
   * (the hero already shows it).
   */
  function deriveMetaFromBody(meta, body) {
    var result = { meta: meta, body: body, derived: {} };
    var lines = String(body || '').split(/\r?\n/);
    var inFence = false;
    var headingIndex = -1;
    var headingText = '';
    var headingLevel = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s{0,3}(```|~~~)/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      var atx = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (atx) {
        headingIndex = i;
        headingLevel = atx[1].length;
        headingText = atx[2].trim();
        break;
      }
      // Setext H1:  Title \n =====
      if (line.trim() && i + 1 < lines.length && /^\s{0,3}=+\s*$/.test(lines[i + 1])) {
        headingIndex = i;
        headingLevel = 1;
        headingText = line.trim();
        break;
      }
      if (line.trim()) break; // content before any heading — don't guess
    }

    if (headingIndex === -1 || !headingText) return result;

    if (!meta.title) {
      meta.title = headingText.replace(/\s*[:\u2013\u2014-]\s*$/, '');
      result.derived.title = true;
      // Only strip the heading when it's a top-level title at the very top.
      if (headingLevel === 1) {
        var drop = headingIndex + 1;
        // setext underline
        if (/^\s{0,3}=+\s*$/.test(lines[headingIndex + 1] || '')) drop += 1;
        while (drop < lines.length && lines[drop].trim() === '') drop += 1;
        result.body = lines.slice(drop).join('\n');
      }
    }

    if (!meta.summary) {
      var searchFrom = (result.body === body) ? headingIndex + 1 : 0;
      var searchLines = (result.body === body) ? lines : result.body.split(/\r?\n/);
      var para = [];
      for (var j = searchFrom; j < searchLines.length; j++) {
        var l = searchLines[j];
        if (/^\s{0,3}(```|~~~)/.test(l)) break;
        if (/^\s{0,3}#{1,6}\s/.test(l)) { if (para.length) break; else continue; }
        if (/^\s{0,3}([-*_]\s*){3,}$/.test(l)) { if (para.length) break; else continue; }
        if (/^\s{0,3}[-*+]\s|^\s{0,3}\d+\.\s|^\s{0,3}>|^\s{0,3}\|/.test(l)) { if (para.length) break; else continue; }
        if (!l.trim()) { if (para.length) break; else continue; }
        para.push(l.trim());
      }
      if (para.length) {
        var text = para.join(' ')
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // images
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')          // links -> text
          .replace(/[*_`]+/g, '')                           // emphasis / code
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 220) text = text.slice(0, 217).replace(/\s+\S*$/, '') + '…';
        if (text) { meta.summary = text; result.derived.summary = true; }
      }
    }

    return result;
  }

  function loadProjectMeta(project) {
    return fetchDoc(project, 'project.md').then(function (res) {
      if (res.status !== 'ok') return { status: res.status, project: project };
      var parsed = parseFrontmatter(res.text);
      var derived = deriveMetaFromBody(parsed.meta, parsed.body);
      var meta = derived.meta;

      // Precedence: real frontmatter > registry values > values guessed
      // from the Markdown body. A guessed title/summary is only a
      // best-effort reading of the document, so an explicit value in
      // projects.json should win over it.
      if (derived.derived.title && project.title) meta.title = project.title;
      if (derived.derived.summary && project.summary) meta.summary = project.summary;

      return {
        status: 'ok',
        project: project,
        meta: meta,
        body: derived.body,
        raw: res.text,
        cached: res.cached
      };
    });
  }

  /* ================================================================
   * Markdown -> HTML rendering
   * ================================================================ */

  /** Creates a marked renderer wired to the project's media URLs. */
  function createRenderer(project, slugger) {
    var Renderer = global.marked.Renderer;
    var renderer = new Renderer();

    renderer.heading = function (token) {
      var depth = token.depth === 1 ? 2 : Math.min(token.depth, 4); // avoid duplicate H1
      var text = token.text || '';
      var id = slugger(text);
      var html = '<h' + depth + ' id="' + escapeHtml(id) + '">';
      html += '<a class="md-anchor" href="#' + escapeHtml(id) + '" aria-hidden="true" tabindex="-1">#</a>';
      html += this.parser.parseInline(token.tokens);
      html += '</h' + depth + '>';
      return html;
    };

    renderer.image = function (token) {
      var candidates = mediaCandidates(token.href);
      var urls = candidates.map(function (p) { return mediaUrl(project, p); });
      var alt = token.text || '';
      var caption = (token.title || alt || '').trim();
      var html = '<figure class="md-figure">';
      html += '<img src="' + escapeHtml(urls[0]) + '" alt="' + escapeHtml(alt) + '"';
      html += ' loading="lazy" decoding="async"';
      html += ' data-candidates="' + escapeHtml(JSON.stringify(urls)) + '"';
      html += '>';
      if (caption) html += '<figcaption>' + escapeHtml(caption) + '</figcaption>';
      html += '</figure>';
      return html;
    };

    renderer.link = function (token) {
      var href = token.href || '';
      var title = token.title ? ' title="' + escapeHtml(token.title) + '"' : '';
      var text = this.parser.parseInline(token.tokens);
      if (/^https?:/i.test(href)) {
        return '<a href="' + escapeHtml(href) + '"' + title + ' target="_blank" rel="noopener noreferrer">' + text + '</a>';
      }
      return '<a href="' + escapeHtml(href) + '"' + title + '>' + text + '</a>';
    };

    return renderer;
  }

  /** Renders a Markdown string to sanitized HTML. */
  function renderMarkdown(md, project) {
    if (!hasMarked()) {
      throw new Error('marked library not loaded');
    }
    var slugger = makeSlugCounter();
    var renderer = createRenderer(project, slugger);
    var html = global.marked.parse(md, { renderer: renderer, gfm: true, breaks: false });
    return sanitizeHtml(html);
  }

  function sanitizeHtml(html) {
    if (!hasDOMPurify()) return html;
    return global.DOMPurify.sanitize(html, {
      ADD_ATTR: ['target', 'loading', 'decoding', 'data-candidates'],
      USE_PROFILES: { html: true }
    });
  }

  /* ================================================================
   * modules.md -> structured modules
   * ================================================================ */

  /**
   * Splits modules.md into modules. Expected structure:
   *   ## Module 01 — Data Ingestion
   *   (intro text)
   *   ### Purpose
   *   ...
   *   ### Lessons Learned
   * Returns { title, modules: [{ id, title, introHtml, sections: [{ id, title, html }] }] }
   */
  function splitModules(mdText, project) {
    if (!hasMarked()) {
      throw new Error('marked library not loaded');
    }
    var tokens = global.marked.lexer(String(mdText || ''), { gfm: true });

    // First H1 (if any) is the document title
    var title = null;
    var clean = [];
    tokens.forEach(function (t) {
      if (t.type === 'heading' && t.depth === 1 && title === null) {
        title = t.text;
      } else {
        clean.push(t);
      }
    });

    var modules = [];
    var current = null;

    for (var i = 0; i < clean.length; i++) {
      var token = clean[i];
      if (token.type === 'heading' && token.depth === 2) {
        if (current) modules.push(current);
        current = { title: token.text || '', sections: [], loose: [] };
        continue;
      }
      if (!current) continue;
      if (token.type === 'heading' && token.depth === 3) {
        current.sections.push({ title: token.text || '', tokens: [] });
        continue;
      }
      if (token.type === 'heading') continue; // h4+ inside a module -> treat as content
      var bucket = current.sections.length
        ? current.sections[current.sections.length - 1].tokens
        : current.loose;
      bucket.push(token);
    }
    if (current) modules.push(current);

    var slugger = makeSlugCounter();
    var renderer = createRenderer(project, slugger);
    var renderTokens = function (list) {
      if (!list.length) return '';
      return global.marked.parser(list, { renderer: renderer, gfm: true });
    };

    return {
      title: title,
      modules: modules.map(function (m) {
        var id = slugger(m.title);
        return {
          id: id,
          title: m.title,
          introHtml: sanitizeHtml(renderTokens(m.loose)),
          sections: m.sections.map(function (s) {
            return {
              id: slugger(s.title),
              title: s.title,
              html: sanitizeHtml(renderTokens(s.tokens))
            };
          })
        };
      })
    };
  }

  /* ================================================================
   * Image fallback handling (browser only)
   * ================================================================ */

  var PLACEHOLDER_URL = 'assets/img/placeholder.svg';

  /**
   * Attaches error handlers to every rendered image that carries a
   * data-candidates list: on error it tries the next candidate URL,
   * then falls back to a branded placeholder.
   */
  function bindImageFallbacks(rootEl) {
    if (!rootEl || typeof document === 'undefined') return;
    var imgs = rootEl.querySelectorAll('img[data-candidates]');
    Array.prototype.forEach.call(imgs, function (img) {
      var candidates;
      try {
        candidates = JSON.parse(img.getAttribute('data-candidates') || '[]');
      } catch (e) {
        candidates = [];
      }
      if (!candidates.length) return;
      var idx = 0;
      img.addEventListener('error', function handler() {
        idx += 1;
        if (idx < candidates.length) {
          img.src = candidates[idx];
        } else {
          img.removeEventListener('error', handler);
          img.src = PLACEHOLDER_URL;
          img.classList.add('is-broken');
        }
      });
    });
  }

  /* ================================================================
   * Project cards (shared by landing page + project page)
   * ================================================================ */

  function toolTags(technologies) {
    if (!Array.isArray(technologies) || !technologies.length) return '';
    return technologies.slice(0, 6).map(function (t) {
      return '<span class="tool-tag">' + escapeHtml(t) + '</span>';
    }).join('');
  }

  function projectCardHtml(project, meta, state) {
    var href = 'project.html?id=' + encodeURIComponent(project.id);
    var title = (meta && meta.title) || project.title || project.repo || project.id;
    var summary = (meta && meta.summary) || project.summary || '';
    var category = (meta && meta.category) || project.category || '';
    var techs = (meta && meta.technologies) || project.technologies || [];
    var cover = mediaUrl(project, normalizeCoverPath(meta && meta.cover));
    var gh = (meta && meta.github) || repoUrl(project);
    var demo = project.demo ? '<span class="project-card__demo-badge">Demo</span>' : '';
    var categoryHtml = category
      ? '<span class="project-card__badge">' + escapeHtml(category) + '</span>' : '';

    if (state === 'missing' || state === 'error') {
      var expectedRepo = project.owner && project.repo
        ? escapeHtml(project.owner + '/' + project.repo)
        : escapeHtml(project.localRoot || project.id);
      return (
        '<article class="project-card project-card--pending" data-id="' + escapeHtml(project.id) + '">' +
          '<div class="project-card__media project-card__media--placeholder">' +
            '<svg class="project-card__pending-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
          '</div>' +
          '<div class="project-card__body">' +
            '<h3 class="project-card__title">' + escapeHtml(title) + '</h3>' +
            '<p class="project-card__summary">' + escapeHtml(summary) + '</p>' +
            '<div class="project-card__tools">' + toolTags(techs) + '</div>' +
            '<div class="project-card__notice">' +
              (state === 'missing'
                ? '<strong>Documentation not published yet.</strong> This card fills itself automatically once the repository is live — expected at ' +
                  '<code>' + expectedRepo + '</code>' +
                  ' <code>documentation/project.md</code>.'
                : '<strong>Could not load documentation.</strong> Check your connection and try again.') +
              '<a class="project-card__notice-link" href="https://github.com/muvandii/muvandii.github.io/blob/main/README.md#how-to-add-a-new-project" target="_blank" rel="noopener noreferrer">How to publish a project &rarr;</a>' +
            '</div>' +
            '<div class="project-card__footer">' +
              '<a class="btn btn--primary btn--sm" href="' + escapeHtml(gh) + '" target="_blank" rel="noopener noreferrer">Open Repository</a>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }

    return (
      '<article class="project-card" data-id="' + escapeHtml(project.id) + '">' +
        '<a class="project-card__media" href="' + escapeHtml(href) + '" tabindex="-1" aria-hidden="true">' +
          '<img class="project-card__cover" src="' + escapeHtml(cover) + '" alt="' + escapeHtml(title) + ' cover image"' +
            ' data-candidates="' + escapeHtml(JSON.stringify([cover, PLACEHOLDER_URL])) + '"' +
            ' loading="lazy" decoding="async">' +
          categoryHtml + demo +
        '</a>' +
        '<div class="project-card__body">' +
          '<h3 class="project-card__title"><a href="' + escapeHtml(href) + '">' + escapeHtml(title) + '</a></h3>' +
          '<p class="project-card__summary">' + escapeHtml(summary) + '</p>' +
          '<div class="project-card__tools">' + toolTags(techs) + '</div>' +
          '<div class="project-card__footer">' +
            '<a class="btn btn--primary btn--sm" href="' + escapeHtml(href) + '">View Case Study<span class="btn__arrow" aria-hidden="true">&rarr;</span></a>' +
            '<a class="btn btn--ghost btn--sm btn--icon" href="' + escapeHtml(gh) + '" target="_blank" rel="noopener noreferrer" aria-label="' + escapeHtml(title) + ' on GitHub">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function skeletonCardHtml() {
    return (
      '<article class="project-card project-card--skeleton" aria-hidden="true">' +
        '<div class="project-card__media skeleton-block"></div>' +
        '<div class="project-card__body">' +
          '<div class="skeleton-block skeleton-line skeleton-line--title"></div>' +
          '<div class="skeleton-block skeleton-line"></div>' +
          '<div class="skeleton-block skeleton-line skeleton-line--short"></div>' +
          '<div class="skeleton-block skeleton-line skeleton-line--tools"></div>' +
          '<div class="skeleton-block skeleton-line skeleton-line--btn"></div>' +
        '</div>' +
      '</article>'
    );
  }

  /**
   * Renders the project grid. Keeps registry order; published projects
   * are sorted by their optional frontmatter `order` value.
   */
  function renderProjectGrid(container, registry, opts) {
    opts = opts || {};
    var skeletons = Math.min(registry.projects.length, 6);
    var skeletonHtml = '';
    for (var i = 0; i < skeletons; i++) skeletonHtml += skeletonCardHtml();
    container.innerHTML = skeletonHtml;

    var tasks = registry.projects.map(function (p) {
      return loadProjectMeta(p).then(function (res) {
        return { project: p, res: res };
      });
    });

    return Promise.all(tasks).then(function (results) {
      // sort: published first (by meta.order, then registry index), pending after
      var published = results.filter(function (r) { return r.res.status === 'ok'; });
      var pending = results.filter(function (r) { return r.res.status !== 'ok'; });
      published.sort(function (a, b) {
        var ao = (a.res.meta && typeof a.res.meta.order === 'number') ? a.res.meta.order : 999;
        var bo = (b.res.meta && typeof b.res.meta.order === 'number') ? b.res.meta.order : 999;
        if (ao !== bo) return ao - bo;
        return registry.projects.indexOf(a.project) - registry.projects.indexOf(b.project);
      });
      var ordered = published.concat(pending);

      var html = ordered.map(function (r) {
        return projectCardHtml(r.project, r.res.status === 'ok' ? r.res.meta : null, r.res.status);
      }).join('');
      container.innerHTML = html;
      bindImageFallbacks(container);
      if (opts.onRendered) opts.onRendered(container);
      return results;
    });
  }

  /* ================================================================
   * Shared header / nav behavior (both pages)
   * ================================================================ */

  function initHeader() {
    var header = document.getElementById('header');
    var navToggle = document.getElementById('navToggle');
    var navList = document.getElementById('navList');
    var navOverlay = document.getElementById('navOverlay');
    var backToTop = document.getElementById('backToTop');
    var navLinks = document.querySelectorAll('.nav__link[data-section]');
    var allNavLinks = document.querySelectorAll('.nav__link');
    var menuOpen = false;

    function openMenu() {
      menuOpen = true;
      navList.classList.add('nav__list--open');
      navOverlay.classList.add('nav__overlay--open');
      navToggle.classList.add('nav__toggle--open');
      navToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      menuOpen = false;
      navList.classList.remove('nav__list--open');
      navOverlay.classList.remove('nav__overlay--open');
      navToggle.classList.remove('nav__toggle--open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    if (navToggle) navToggle.addEventListener('click', function () {
      menuOpen ? closeMenu() : openMenu();
    });
    if (navOverlay) navOverlay.addEventListener('click', closeMenu);
    allNavLinks.forEach(function (link) {
      link.addEventListener('click', function () { if (menuOpen) closeMenu(); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) { closeMenu(); navToggle.focus(); }
    });

    function handleScroll() {
      var scrollY = window.scrollY || 0;
      if (header) header.classList.toggle('header--scrolled', scrollY > 10);
      if (backToTop) backToTop.classList.toggle('back-to-top--visible', scrollY > 500);
      if (navLinks.length) {
        var sections = document.querySelectorAll('section[id]');
        var currentSection = 'home';
        sections.forEach(function (section) {
          var top = section.offsetTop - 140;
          var height = section.offsetHeight;
          if (scrollY >= top && scrollY < top + height) {
            currentSection = section.getAttribute('id');
          }
        });
        navLinks.forEach(function (link) {
          link.classList.toggle('nav__link--active', link.getAttribute('data-section') === currentSection);
        });
      }
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () { handleScroll(); ticking = false; });
      }
    }, { passive: true });
    handleScroll();

    if (backToTop) backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // basic focus trap for the mobile menu
    if (navList) navList.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && menuOpen) {
        var focusable = navList.querySelectorAll('a[href], button:not([disabled])');
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ================================================================
   * Export
   * ================================================================ */

  var api = {
    RAW_BASE: RAW_BASE,
    DOC_DIR: DOC_DIR,
    CACHE_TTL: CACHE_TTL,
    escapeHtml: escapeHtml,
    slugify: slugify,
    makeSlugCounter: makeSlugCounter,
    parseFrontmatter: parseFrontmatter,
    normalizePath: normalizePath,
    resolveRelative: resolveRelative,
    mediaCandidates: mediaCandidates,
    normalizeCoverPath: normalizeCoverPath,
    mediaRoot: mediaRoot,
    docsDir: docsDir,
    docUrl: docUrl,
    mediaUrl: mediaUrl,
    repoUrl: repoUrl,
    repoDocsUrl: repoDocsUrl,
    fetchDoc: fetchDoc,
    normalizeRegistry: normalizeRegistry,
    deriveMetaFromBody: deriveMetaFromBody,
    loadRegistry: loadRegistry,
    loadProjectMeta: loadProjectMeta,
    renderMarkdown: renderMarkdown,
    sanitizeHtml: sanitizeHtml,
    splitModules: splitModules,
    bindImageFallbacks: bindImageFallbacks,
    projectCardHtml: projectCardHtml,
    skeletonCardHtml: skeletonCardHtml,
    renderProjectGrid: renderProjectGrid,
    initHeader: initHeader
  };

  global.MuvandiiPortfolio = api;
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
