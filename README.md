# Muvandii — Portfolio Website

Professional portfolio for a Data Analyst / Data Professional, built with **pure HTML, CSS and
JavaScript** — no frameworks, no build step, fully **GitHub Pages** compatible.

Every project is documented in its **own GitHub repository** using a standard structure. The
portfolio reads that documentation **directly from GitHub at runtime** — you never copy or
duplicate documentation into this website.

```
Portfolio (this site)
    │  fetch at runtime (raw.githubusercontent.com)
    ▼
Project (its own GitHub repository)
    │
    ▼
documentation/
    ├── project.md    ← title, cover, summary, full case study
    └── modules.md    ← module-by-module documentation
```

---

## Table of contents

1. [Quick start — add a new project](#how-to-add-a-new-project)
2. [How the site is built](#how-the-site-is-built)
3. [The standard project repository structure](#the-standard-project-repository-structure)
4. [Where titles & cover images live](#where-titles--cover-images-live)
5. [Frontmatter reference](#frontmatter-reference)
6. [How Markdown images work](#how-markdown-images-work)
7. [How the portfolio loads the Markdown](#how-the-portfolio-loads-the-markdown)
8. [modules.md — module structure](#modulesmd--module-structure)
9. [Local development](#local-development)
10. [Limitations of GitHub Pages / static hosting](#limitations-of-github-pages--static-hosting)
11. [Design & implementation notes](#design--implementation-notes)

---

## How to add a new project

1. **Create the project repository** on GitHub using the bundled template:
   copy the folder [`templates/project-repository/`](templates/project-repository/) into the new
   repository (keep the folder names exactly: `documentation/`, `images/`, `src/`).
2. **Fill in the content:**
   - `documentation/project.md` — frontmatter (title, summary, cover, technologies) + case study body.
   - `documentation/modules.md` — one `## Module NN — Name` section per module.
   - `images/cover.png` — the project's main image (1200×750 recommended).
3. **Push the repository** — it must be **public**.
4. **Add one entry** to [`assets/data/projects.json`](assets/data/projects.json):

```json
{
  "id": "my-project-slug",
  "repo": "my-project-repository",
  "branch": "main"
}
```

That's it. The site picks the project up automatically — title, summary, category,
technologies, cover image, case study body and modules are all read from the repository.
No HTML edits. To remove a project, delete its entry from the registry.

> The template also includes a working example project ("Retail Sales Consolidation") that is
> registered in the registry as a **demo** so you can see the full pipeline end-to-end. Delete
> that entry when your real repositories are live.

---

## How the site is built

```
muvandii.github.io/
├── index.html                    ← landing page (hero, skills, projects, about, contact)
├── project.html                  ← case-study page (one template for every project)
├── 404.html                      ← branded 404
├── README.md                     ← this file
├── assets/
│   ├── css/style.css             ← all styles (single shared stylesheet)
│   ├── data/projects.json        ← PROJECT REGISTRY — the only file to edit per project
│   ├── img/placeholder.svg       ← fallback image when a cover is missing
│   ├── js/
│   │   ├── site.js               ← core library (fetch, frontmatter, markdown, modules)
│   │   ├── index.js              ← landing page behavior
│   │   └── project.js            ← case-study page behavior
│   ├── vendor/
│   │   ├── marked.umd.js         ← Markdown parser (v18, MIT) — vendored, no CDN needed
│   │   └── purify.min.js         ← HTML sanitizer (v3, Apache-2.0) — vendored
│   └── svgs/                     ← logo assets
├── templates/
│   └── project-repository/       ← copy this into every new project repository
│       ├── README.md
│       ├── documentation/{project.md, modules.md}
│       ├── images/{cover.png, screenshot-01.png, screenshot-02.png, README.md}
│       └── src/
└── tests/site.test.js            ← unit tests for the core library
```

- **No build step.** Commit and push; GitHub Pages serves it.
- **No external runtime dependencies.** The Markdown parser and sanitizer are vendored
  locally; the only external request is Google Fonts (with system-font fallbacks).
- **Two pages total.** The project case-study page is a single template; `project.html?id=slug`
  decides which repository to load.

---

## The standard project repository structure

Every project lives in its own repository and must follow this structure:

```
project-repository/
│
├── documentation/            ← read by the portfolio
│   ├── project.md            ← frontmatter + full case study
│   └── modules.md            ← module-by-module documentation
│
├── images/                   ← all images referenced from the docs
│   ├── cover.png             ← main project image (card + case-study hero)
│   ├── screenshot-01.png
│   └── …
│
├── src/                      ← actual project files (workbooks, .pbix, scripts, code)
├── data/                     ← sample/input data (optional)
└── README.md
```

The folder names `documentation/` and `images/` and the file names `project.md`,
`modules.md`, `cover.png` are **conventions the portfolio relies on**. They are exactly the
structure in [`templates/project-repository/`](templates/project-repository/).

---

## Where titles & cover images live

**Both live in `documentation/project.md`, inside each project's repository, as YAML
frontmatter** — the single source of truth:

```yaml
---
title: Retail Sales Consolidation      ← project title (card, hero, browser tab)
summary: One-sentence description      ← card text + meta description
category: Data Analytics               ← badge on card + hero
cover: images/cover.png                ← main image path (repo-root-relative)
technologies:                          ← chips on card + hero
  - Power Query
  - Excel
  - Power BI
order: 1                               ← optional: sort position on the landing page
github: https://github.com/…           ← optional: override the repository link
---
```

- The **title** is stored in the `title` frontmatter field.
- The **cover image** is stored in the repo at `images/cover.png` and referenced by the
  `cover` frontmatter field (default: `images/cover.png`).
- The registry (`assets/data/projects.json`) only stores the **location** of the repository
  (owner, repo, branch) — never the title or image. You enter the title and image **once**,
  in the repository, and the portfolio reads them automatically.
- The registry may optionally hold fallback `title`/`summary`/`technologies` values, shown
  only while the repository is not yet published (they're ignored as soon as the repo is live).

---

## Frontmatter reference

| Field | Type | Required | Used for |
|---|---|---|---|
| `title` | string | yes | Card title, case-study hero, `<title>`, OG tags |
| `summary` | string | recommended | Card text, meta description |
| `category` | string | no | Badge on card and hero |
| `cover` | string | no (default `images/cover.png`) | Card image, hero image, OG image |
| `technologies` | list | no | Chips on card and hero |
| `order` | number | no | Sort order among published projects (lower first) |
| `github` | string | no | Override the "View on GitHub" link |

Supported frontmatter syntax: `key: value`, quoted values, block lists (`key:` + `  - item`),
and inline lists (`key: [a, b]`).

---

## How Markdown images work

**1. Where images are stored** — in each project repository's `images/` folder (repo root).

**2. How they're referenced** — with paths relative to the `documentation/` folder, exactly as
GitHub renders them:

```markdown
![Data Cleaning Process](../images/data-cleaning.png)
```

`../images/…` from `documentation/` resolves to `<repo-root>/images/…`. The same relative
path therefore works identically in three places: on github.com, in the portfolio, and in any
Markdown viewer.

**3. How the portfolio resolves them** — when rendering, the site rewrites each image URL to

```
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/images/data-cleaning.png
```

using the same `../` resolution rules as GitHub. As a safety net, if an image fails to load
the site automatically tries the repo-root `images/` interpretation, then falls back to a
branded placeholder. **No image path is hardcoded anywhere in the site** — resolution is
derived from the registry (owner/repo/branch) plus the relative path in the Markdown.

**4. Cover image** — the frontmatter `cover` path is relative to the **repository root**
(`images/cover.png`), and is resolved to the raw URL the same way.

**5. Different projects, different images** — works automatically: each project's images are
resolved against *its own* repository. Nothing to configure per project.

---

## How the portfolio loads the Markdown

At runtime, the browser fetches:

```
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/documentation/project.md
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/documentation/modules.md
```

1. `raw.githubusercontent.com` sends `Access-Control-Allow-Origin: *`, so any static site —
   including GitHub Pages — can fetch it directly. No backend, no API token, no build step.
2. The YAML frontmatter of `project.md` is parsed for metadata (title, cover, …).
3. The body of `project.md` is rendered with `marked` and sanitized with `DOMPurify`
   (both vendored locally). Heading IDs, anchor links, external-link handling and the image
   URL rewriting described above are applied during rendering.
4. `modules.md` is split into modules (`## Module NN — …`) and their sub-sections
   (`### Purpose`, `### Input`, …) and rendered with navigation, numbering and prev/next
   paging — generated from the file, never hand-written in HTML.
5. Fetched documentation is cached in `localStorage` for 30 minutes to keep repeat visits
   fast and GitHub requests polite.
6. If a repository isn't published yet (404), the card/page shows a clear "awaiting
   publish" state — and fills itself in automatically the moment the repository goes live.

The registry itself (`assets/data/projects.json`) is the only piece that must exist locally,
and it contains only locator data. (The bundled demo project uses a same-origin
`localRoot` instead of GitHub so you can preview the pipeline before any repo exists.)

---

## modules.md — module structure

```markdown
# Project Name — Module Documentation   (optional H1)

## Module 01 — Data Ingestion

Intro paragraph (optional).

### Purpose
### Input
### Requirements
### Process
### Implementation
### Output
### Validation
### Evidence
### Challenges
### Solution
### Results
### Lessons Learned

## Module 02 — Data Cleaning
…
```

- **`## Module NN — Name`** starts a module; **`### Section`** headings inside it become the
  labelled sub-sections (the 12 standard ones above — you may use fewer or more).
- The portfolio renders each module as a card with a numbered header, a sticky module
  navigator, prev/next paging, and icon labels for the standard sections.
- The structure is deliberately generic: it works for Excel/Power Query projects, Python,
  SQL, analytics, data engineering, and web applications alike.
- Markdown inside any section is fully supported (tables, code blocks, lists, and images
  via the `../images/` convention).

---

## Local development

Serve the folder with any static server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Run the unit tests (Node 18+):

```bash
node --test tests/site.test.js
```

Deployment is unchanged: push to `main` — GitHub Pages serves the repository root
(already configured for `muvandii.github.io`).

---

## Limitations of GitHub Pages / static hosting

| Limitation | Impact | Mitigation |
|---|---|---|
| Project repositories must be **public** | Private repos can't be read by visitors | Make project repos public (sample data only — never secrets) |
| Content renders **client-side** (JavaScript) | Requires JS enabled; search engines index the rendered content but it's not pre-rendered HTML | Static fallback cards + full meta/OG/JSON-LD tags; consider a build-time fetcher (below) if pre-rendering ever matters |
| Relies on `raw.githubusercontent.com` | If GitHub is down or blocked, documentation sections show a retry state (site itself still works) | Cached copies in `localStorage`; graceful error panels with direct links to GitHub |
| No hard guarantee of freshness | `raw.githubusercontent.com` can serve slightly stale content for a few minutes after a push | Cached 30 min locally; a manual refresh resolves it |
| SEO of `project.html?id=…` URLs | Query-string URLs are indexable but less canonical-looking | Canonical tags set per project; landing page is fully static |

**If you ever want fully pre-rendered pages** (docs baked into HTML at build time), the
architecture supports it: keep the same registry and markdown files, and add a GitHub
Actions workflow that runs `marked` over each repo's `documentation/` at build time and
commits the HTML. The current runtime approach was chosen because it requires **zero
maintenance** — documentation changes appear on the site automatically with no rebuild.

---

## Design & implementation notes

- **Design**: refined, not rebuilt — the navy/gold/blue palette and Inter typography were
  kept and polished; spacing, hierarchy, hover states, focus rings, mobile navigation,
  loading skeletons, scroll-reveal and reduced-motion support were added across all pages.
- **Dependencies**: `marked` (MIT) and `DOMPurify` (Apache-2.0) are vendored under
  `assets/vendor/` with their license headers intact — the site works without any CDN.
- **Tests**: the core logic (frontmatter parsing, path resolution, image rewriting, module
  splitting, rendering) is covered by `tests/site.test.js`.
