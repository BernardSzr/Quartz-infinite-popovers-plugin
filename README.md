# Quartz Infinite Popovers

无限嵌套弹窗预览插件，适用于 [Quartz](https://github.com/jackyzha0/quartz)。灵感来自 [gwern.net](https://gwern.net)。

## 功能

- 悬浮内部链接弹出预览弹窗，支持无限嵌套
- 每个弹窗可独立 pin、拖动、调整大小
- pin / unpin 切换
- 拖动工具栏自动 pin
- 拖动边角自动 pin 并调整大小
- 新标签页打开
- 亮色 / 暗色主题自动跟随

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
npx quartz install-plugins
npx quartz build --serve
```

## 依赖

- `@floating-ui/dom`（自动安装）
- `preact`（Quartz 自带）
