declare module "*.scss?raw" {
  const content: string
  export default content
}

declare module "*.inline?raw" {
  const content: string
  export default content
}

interface Window {
  addCleanup: (cb: () => void) => void
}
