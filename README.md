[English](README.md) | [中文](README-zh.md)

# Quartz Infinite Popovers

An infinitely recursive popovers plugin for [Quartz](https://github.com/jackyzha0/quartz), inspired by [gwern.net](https://gwern.net).

## Features

- Support infinitely recursive popovers on websites based on [Quartz](https://github.com/jackyzha0/quartz)
- Each popover can be independently pinned, dragged, resized, and opened in a new tab
- Light / dark theme auto-adaptive
- Auto-disabled on mobile (screen width < 700px)

## Installation

Disable the official Quartz popover and add this plugin in `quartz.config.yaml`:

```yaml
plugins:
  - source: "@jackyzha0/quartz"
    components:
      Popover:
        enabled: false
  - source: https://github.com/BernardSzr/Quartz-infinite-popovers-plugin
    enabled: true
    layout:
      position: afterBody
      priority: 0
```

Then run:

```bash
npx quartz plugin install --from-config
npx quartz build --serve
```

## Dependencies

- `@floating-ui/dom` (auto-installed)
- `preact` (bundled with Quartz)
