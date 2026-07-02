import type { QuartzComponent, QuartzComponentProps } from "@quartz-community/types"
// @ts-expect-error — inline script import handled by Quartz bundler
import script from "../scripts/infinitePopovers.inline.ts"
// @ts-expect-error — style import handled by Quartz bundler
import style from "../styles/infinitePopovers.scss"

const InfinitePopover: QuartzComponent = (_props: QuartzComponentProps) => {
  // No server-side rendering needed — this component is purely client-side
  return null
}

const component = InfinitePopover as QuartzComponent & { displayName: string; css: string }
component.displayName = "InfinitePopover"
component.afterDOMLoaded = script
component.css = style

export { component as InfinitePopover }
