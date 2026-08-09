/**
 * Unit tests for the portfolio's documentation system core (site.js).
 * Run with:  node --test tests/
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Load the core library (it exports via module.exports in Node)
const P = require('../assets/js/site.js');

// Load marked so rendering can be tested too
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = { window: {}, self: {} };
ctx.window = ctx;
ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'vendor', 'marked.umd.js'), 'utf8'), ctx);
global.marked = ctx.marked;

const SAMPLE_MD = `---
title: Retail Sales Consolidation
summary: A short summary used on cards and meta tags.
category: Data Analytics
cover: images/cover.png
technologies:
  - Python
  - Pandas
  - Excel
order: 2
---

## Project Overview

Some *overview* text.

![Data Cleaning Process](../images/data-cleaning.png)

## Business Problem

A [link](https://example.com) and a table:

| A | B |
|---|---|
| 1 | 2 |
`;

test('parseFrontmatter: extracts metadata and body', () => {
  const { meta, body } = P.parseFrontmatter(SAMPLE_MD);
  assert.equal(meta.title, 'Retail Sales Consolidation');
  assert.equal(meta.summary, 'A short summary used on cards and meta tags.');
  assert.equal(meta.category, 'Data Analytics');
  assert.equal(meta.cover, 'images/cover.png');
  assert.equal(meta.order, 2);
  assert.deepEqual(meta.technologies, ['Python', 'Pandas', 'Excel']);
  assert.ok(body.startsWith('## Project Overview'));
  assert.ok(body.includes('![Data Cleaning Process](../images/data-cleaning.png)'));
});

test('parseFrontmatter: inline list syntax', () => {
  const { meta } = P.parseFrontmatter('---\ntechnologies: [Python, Pandas, "Power Query"]\n---\nbody');
  assert.deepEqual(meta.technologies, ['Python', 'Pandas', 'Power Query']);
});

test('parseFrontmatter: no frontmatter -> empty meta, full body', () => {
  const { meta, body } = P.parseFrontmatter('# Just a heading\n\nSome text');
  assert.deepEqual(meta, {});
  assert.ok(body.includes('Some text'));
});

test('parseFrontmatter: handles CRLF and BOM', () => {
  const { meta } = P.parseFrontmatter('\uFEFF---\r\ntitle: CRLF Test\r\n---\r\n\r\nbody');
  assert.equal(meta.title, 'CRLF Test');
});

test('resolveRelative: GitHub semantics from documentation/', () => {
  assert.equal(P.resolveRelative('documentation', '../images/foo.png'), 'images/foo.png');
  assert.equal(P.resolveRelative('documentation', 'images/foo.png'), 'documentation/images/foo.png');
  assert.equal(P.resolveRelative('documentation', './images/foo.png'), 'documentation/images/foo.png');
  assert.equal(P.resolveRelative('documentation', '../../foo.png'), 'foo.png');
  assert.equal(P.resolveRelative('documentation', 'sub/diagram.png'), 'documentation/sub/diagram.png');
  assert.equal(P.resolveRelative('documentation', '/images/abs.png'), 'images/abs.png');
  assert.equal(P.resolveRelative('documentation', 'https://x.com/a.png'), 'https://x.com/a.png');
  assert.equal(P.resolveRelative('documentation', '#anchor'), '#anchor');
});

test('mediaCandidates: includes repo-root images/ fallback', () => {
  assert.deepEqual(P.mediaCandidates('../images/foo.png'), ['images/foo.png']);
  assert.deepEqual(P.mediaCandidates('images/foo.png'), ['documentation/images/foo.png', 'images/foo.png']);
  assert.deepEqual(P.mediaCandidates('https://x.com/a.png'), ['https://x.com/a.png']);
});

test('normalizeCoverPath', () => {
  assert.equal(P.normalizeCoverPath('images/cover.png'), 'images/cover.png');
  assert.equal(P.normalizeCoverPath('../images/cover.png'), 'images/cover.png');
  assert.equal(P.normalizeCoverPath(''), 'images/cover.png');
  assert.equal(P.normalizeCoverPath('/images/cover.png'), 'images/cover.png');
  assert.equal(P.normalizeCoverPath('https://x.com/c.png'), 'https://x.com/c.png');
});

test('docUrl / mediaUrl for raw repos', () => {
  const project = { owner: 'muvandii', repo: 'project-01-x', branch: 'main' };
  assert.equal(
    P.docUrl(project, 'project.md'),
    'https://raw.githubusercontent.com/muvandii/project-01-x/main/documentation/project.md'
  );
  assert.equal(
    P.mediaUrl(project, 'images/cover.png'),
    'https://raw.githubusercontent.com/muvandii/project-01-x/main/images/cover.png'
  );
});

test('docUrl / mediaUrl for local (demo) sources', () => {
  const project = { localRoot: 'templates/project-repository' };
  assert.equal(P.docUrl(project, 'project.md'), 'templates/project-repository/documentation/project.md');
  assert.equal(P.mediaUrl(project, 'images/cover.png'), 'templates/project-repository/images/cover.png');
});

test('renderMarkdown: rewrites relative images to raw URLs', () => {
  const project = { owner: 'muvandii', repo: 'project-01-x', branch: 'main' };
  const html = P.renderMarkdown('![Data Cleaning Process](../images/data-cleaning.png)', project);
  assert.ok(html.includes('https://raw.githubusercontent.com/muvandii/project-01-x/main/images/data-cleaning.png'));
  assert.ok(html.includes('<figure'));
  assert.ok(html.includes('loading="lazy"'));
  assert.ok(html.includes('data-candidates'));
});

test('renderMarkdown: external links get target/rel, anchors stay internal', () => {
  const project = { owner: 'muvandii', repo: 'r', branch: 'main' };
  const html = P.renderMarkdown('[ext](https://example.com) and [int](#section-one)', project);
  assert.ok(html.includes('target="_blank" rel="noopener noreferrer"'));
  assert.ok(html.includes('href="#section-one"'));
  assert.ok(!html.includes('href="#section-one" target'));
});

test('renderMarkdown: headings get unique ids, no duplicate h1', () => {
  const project = { owner: 'muvandii', repo: 'r', branch: 'main' };
  const html = P.renderMarkdown('# Title\n\n## Section\n\n## Section\n\n### Sub', project);
  assert.ok(!html.includes('<h1'));
  assert.ok(html.includes('<h2 id="title"'));
  assert.ok(html.includes('<h2 id="section"'));
  assert.ok(html.includes('<h2 id="section-2"'));
  assert.ok(html.includes('<h3 id="sub"'));
});

test('renderMarkdown: tables render (GFM)', () => {
  const project = { owner: 'muvandii', repo: 'r', branch: 'main' };
  const html = P.renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |', project);
  assert.ok(html.includes('<table>'));
});

test('splitModules: groups modules and their sections', () => {
  const project = { owner: 'muvandii', repo: 'r', branch: 'main' };
  const md = `# Sales Reporting Automation — Modules

## Module 01 — Data Ingestion

Intro text for module one.

### Purpose

Load data.

### Evidence

![Step One](../images/screenshot-01.png)

## Module 02 — Data Cleaning

### Purpose

Clean data.

### Validation

All good.

## Module 03 — Analysis

Loose intro only.
`;
  const result = P.splitModules(md, project);
  assert.equal(result.title, 'Sales Reporting Automation — Modules');
  assert.equal(result.modules.length, 3);
  assert.equal(result.modules[0].title, 'Module 01 — Data Ingestion');
  assert.equal(result.modules[0].sections.length, 2);
  assert.equal(result.modules[0].sections[0].title, 'Purpose');
  assert.ok(result.modules[0].introHtml.includes('Intro text for module one'));
  assert.ok(result.modules[0].sections[1].html.includes('screenshot-01.png'));
  assert.equal(result.modules[1].sections[1].title, 'Validation');
  assert.equal(result.modules[2].sections.length, 0);
  assert.ok(result.modules[2].introHtml.includes('Loose intro only'));
});

test('slugify', () => {
  assert.equal(P.slugify('Module 01 — Data Ingestion'), 'module-01-data-ingestion');
  assert.equal(P.slugify('Hello, World!'), 'hello-world');
  assert.equal(P.slugify(''), '');
});
