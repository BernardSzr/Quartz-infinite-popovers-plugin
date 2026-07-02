[English](README.md) | [中文](README-zh.md)

# Quartz Infinite Popovers

An infinitely recursive popovers plugin for [Quartz](https://github.com/jackyzha0/quartz), inspired by [gwern.net](https://gwern.net).

## Features

- Support infinitely recursive popovers on websites based on [Quartz](https://github.com/jackyzha0/quartz)
- Each popover can be independently pinned, dragged, resized, and opened in a new tab
- Light / dark theme auto-adaptive
- Auto-disabled on mobile (screen width < 700px)

## Installation

```bash
npx quartz plugin add github:BernardSzr/Quartz-infinite-popovers-plugin
```

Then disable the official Quartz popover in `quartz.config.yaml`:

```yaml
configuration:
  enablePopovers: false
```

Finally, build and serve:

```bash
npx quartz build --serve
```

## Dependencies

- `@floating-ui/dom` (auto-installed)
- `preact` (bundled with Quartz)
