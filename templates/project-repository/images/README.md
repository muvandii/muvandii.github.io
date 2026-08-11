# images/

This folder holds **all** images used by the project documentation and by the portfolio website.

## Required

| File | Purpose |
|---|---|
| `cover.png` | The project's main image. Shown on the portfolio project card and at the top of the case-study page. Recommended size: **1200 × 750** (16:10). |

## Recommended

| File | Purpose |
|---|---|
| `screenshot-01.png` | First evidence/screenshot used in the documentation. |
| `screenshot-02.png` | Second evidence/screenshot. |
| `screenshot-03.png`, … | Any further screenshots or diagrams. |

## How images are referenced

From inside `documentation/project.md` or `documentation/modules.md`, reference images with a
path **relative to the `documentation/` folder** (exactly like GitHub renders them):

```markdown
![Data Cleaning Process](../images/data-cleaning.png)
```

- `../images/foo.png` → resolves to the repository's `images/foo.png` ✓
- On the portfolio website the same relative path is rewritten automatically to the raw file
  in this repository, so the image appears in the rendered documentation too.
- The same file works in three places without copying it anywhere: on GitHub, in the
  portfolio, and in any Markdown viewer.

### Cover image

`cover.png` is referenced from the YAML frontmatter at the top of `documentation/project.md`:

```yaml
---
cover: images/cover.png
---
```

The cover path is relative to the **repository root** (not the `documentation/` folder).

## Tips

- Keep file sizes reasonable (compress screenshots; ~100–300 KB each is fine).
- Use descriptive file names: `data-cleaning.png`, `dashboard-kpis.png`, `architecture.png`…
- Store diagrams (architecture/flow) here too, as PNG or SVG, and reference them the same way.
