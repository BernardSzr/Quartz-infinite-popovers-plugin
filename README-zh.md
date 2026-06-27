[English](README.md) | [中文](README-zh.md)

# Quartz Infinite Popovers

为[Quartz](https://github.com/jackyzha0/quartz)编写的无限递归式预览弹窗插件，打破[Quartz](https://github.com/jackyzha0/quartz)的单层预览弹窗限制，插件启发自[gwern.net](https://gwern.net)。

## 功能

- 允许基于[Quartz](https://github.com/jackyzha0/quartz)的网站递归式地弹出无限层预览弹窗
- 每个弹窗都可以独立 pin、拖动、调整大小、新标签页打开完整文章
- 亮色 / 暗色主题自动跟随
- 移动端（屏幕宽度 < 700px）自动禁用

## 安装

在 `quartz.config.yaml` 中禁用 Quartz 官方 popover 并添加本插件：

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

然后运行：

```bash
npx quartz plugin install --from-config
npx quartz build --serve
```

## 依赖

- `@floating-ui/dom`（自动安装）
- `preact`（Quartz 自带）
