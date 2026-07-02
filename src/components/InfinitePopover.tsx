import type { QuartzComponent, QuartzComponentProps } from "@quartz-community/types"

// @ts-ignore — esbuild ?raw import for client-side script (bundles all imports)
import script from "../scripts/infinitePopovers?raw"
// @ts-ignore — esbuild ?raw import for styles
import style from "../styles/infinitePopovers.css.txt?raw"

const InfinitePopover: QuartzComponent = (_props: QuartzComponentProps) => {
  // No server-side rendering needed — this component is purely client-side
  return null
}

const component = InfinitePopover as QuartzComponent & { displayName: string; css: string }
component.displayName = "InfinitePopover"
component.afterDOMLoaded = script
component.css = style

export { component as InfinitePopover }
