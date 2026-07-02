import { computePosition, flip, offset, autoPlacement, shift } from "@floating-ui/dom"

const domParser = new DOMParser()

const _rebaseHtmlElement = (el: Element, attr: string, newBase: string | URL) => {
  const rebased = new URL(el.getAttribute(attr)!, newBase) 
  // newBase包含origin（https://...com）+pathname（/page/...），
  // el.getAttribute(attr)可能是相对路径（./...）或者绝对路径（/...），
  // rebased会正确解析出完整的URL(图片等资源的URL)，并且保留hash（#...）部分，形如https://...com/page/...#section1
  el.setAttribute(attr, rebased.pathname + rebased.hash) //站内访问，不需要origin部分
}

function normalizeRelativeURLs(el: Element | Document, destination: string | URL) {
  el.querySelectorAll('[href=""], [href^="./"], [href^="../"]').forEach((item) => {
    _rebaseHtmlElement(item, "href", destination)
  })
  el.querySelectorAll('[src=""], [src^="./"], [src^="../"]').forEach((item) => {
    _rebaseHtmlElement(item, "src", destination)
  })
}//对某个元素或者文档内部的所有链接（href）和资源（src）进行重写，使其相对于目标URL（destination）进行访问，确保在popover中显示的内容中的链接和资源能够正确加载。

const canonicalRegex = /<link rel="canonical" href="([^"]*)">/


async function fetchCanonical(url: URL): Promise<Response> {
  const res = await fetch(`${url}`)
  if (!res.headers.get("content-type")?.startsWith("text/html")) {
    return res
  }
  const text = await res.clone().text()
  const [_, redirect] = text.match(canonicalRegex) ?? []  
  //redirect是canonical链接的href属性值，是一个相对路径，由canonicalRegex正则表达式匹配得到，如果没有匹配到，则为undefined
  return redirect ? fetch(`${new URL(redirect, url)}`) : res
  //如果存在canonical链接，拼接成完整的URL（带http头的绝对路径）并重新fetch，否则返回原始响应
}

//以上就是处理路径问题的代码，可以这样看：normalizeRelativeURLs函数是把原文档里的相对路径转为绝对路径（但是不带origin部分）
//而fetchCanonical返回的是一个Response对象，函数内部因为要fetch,所以操作的都是完整的URL（带origin部分）


//------模块级变量，管理当前页面所有popover的状态和关系----------------

let activeAnchor: HTMLAnchorElement | null = null

let currentActivePopoverNode: PopoverNode | null = null

const ALIVE_REGION_DEBOUNCE = 750

const popovers = new Map<string, PopoverNode>()

let leaveAliveRegionTimer: ReturnType<typeof setTimeout> | null = null

const pendingFetchLinks = new Set<HTMLAnchorElement>()

let mouseX = 0

let mouseY = 0

let isDragging = false
let dragTarget: PopoverNode | null = null
let dragOffsetX = 0
let dragOffsetY = 0

let isResizing = false
let resizeTarget: PopoverNode | null = null
let resizeStartX = 0
let resizeStartY = 0
let resizeStartWidth = 0
let resizeStartHeight = 0
let resizeAnchorLeft = false
let resizeAnchorTop = false
let resizeStartTranslateX = 0
let resizeStartTranslateY = 0

//图标常量
const iconPin = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-pin"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>'
const iconPinFilled = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-pin"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>'
const iconClose = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
const iconMaximize = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'

//---------------------------------------------------------------

class PopoverNode {
  id: string
  element: HTMLElement
  url: string
  spawningLink: HTMLAnchorElement
  parent: PopoverNode | null = null
  child: PopoverNode | null = null
  pinned: boolean = false

  constructor(
    id: string,
    element: HTMLElement,
    url: string,
    spawningLink: HTMLAnchorElement,
  ) {
    this.id = id
    this.element = element
    this.url = url
    this.spawningLink = spawningLink
  }
}

function insertNodeIntoPopovers(node: PopoverNode) {
  let prev: PopoverNode | null = currentActivePopoverNode
  if (prev) {
    prev.child = node
    node.parent = prev
  }
  node.child = null
  popovers.set(node.id, node)
}

function deleteNodeFromPopovers(node: PopoverNode) {
  if (node.parent) {
    node.parent.child = node.child
    if (node.child)
      node.child.parent = node.parent
  }
  else {
    if (node.child) 
      node.child.parent = null
  }
  popovers.delete(node.id)
}

function setLeaveAliveRegionTimer() {
  if (leaveAliveRegionTimer) return  //必须要设置成不可覆盖，否则用户可以靠一直在空白区域滑动鼠标来让弹窗永生
  leaveAliveRegionTimer = setTimeout(() => {
    detectAndDestroy()
  }, ALIVE_REGION_DEBOUNCE)
}

function clearLeaveAliveRegionTimer() {
  if (!leaveAliveRegionTimer) return
  clearTimeout(leaveAliveRegionTimer)
  leaveAliveRegionTimer = null
}

function onDragMove(event: MouseEvent) {
  if (!isDragging || !dragTarget) return
  const rect = dragTarget.element.getBoundingClientRect()
  let newX = event.clientX - dragOffsetX
  let newY = event.clientY - dragOffsetY
  //限制 toolbar 不超出视口
  newX = Math.max(-rect.left, Math.min(newX, window.innerWidth - rect.right + rect.left))
  newY = Math.max(-rect.top, Math.min(newY, window.innerHeight - rect.bottom + rect.top))
  dragTarget.element.style.transform = `translate(${newX}px, ${newY}px)`
}

function onDragEnd() {
  isDragging = false
  dragTarget = null
}

function onResizeMove(event: MouseEvent) {
  if (!isResizing || !resizeTarget) return
  const minSize = Math.min(window.innerWidth, window.innerHeight) * 0.4
  //鼠标不超出视口
  const cx = Math.max(0, Math.min(event.clientX, window.innerWidth))
  const cy = Math.max(0, Math.min(event.clientY, window.innerHeight))
  const dx = cx - resizeStartX
  const dy = cy - resizeStartY
  const w = resizeAnchorLeft ? resizeStartWidth - dx : resizeStartWidth + dx
  const h = resizeAnchorTop ? resizeStartHeight - dy : resizeStartHeight + dy
  resizeTarget.element.style.width = Math.max(minSize, w) + "px"
  resizeTarget.element.style.height = Math.max(minSize, h) + "px"
  //拖拽左/上锚点时，移动弹窗让对角固定
  const tx = resizeAnchorLeft ? resizeStartTranslateX + dx : resizeStartTranslateX
  const ty = resizeAnchorTop ? resizeStartTranslateY + dy : resizeStartTranslateY
  resizeTarget.element.style.transform = `translate(${tx}px, ${ty}px)`
}

function onResizeEnd() {
  isResizing = false
  resizeTarget = null
}

function handleMouseMove(event: MouseEvent) {
  if (isDragging || isResizing) return
  mouseX = event.clientX
  mouseY = event.clientY
  const el = document.elementFromPoint(mouseX, mouseY)
  const anchor = el?.closest("a.internal-link") as HTMLAnchorElement | null
  const popover = getThePopoverMouseIsAt({mouseX, mouseY})

  if (anchor) {
    if (currentActivePopoverNode && anchor === currentActivePopoverNode.spawningLink) {
      clearLeaveAliveRegionTimer()
    } 
    else if (currentActivePopoverNode && anchor !== currentActivePopoverNode.spawningLink) {
      detectAndDestroy()
      //有可能直接跳到博客页面了，也就是说不存在任何popover了，所以此时currentActivePopoverNode可能为null
      //该函数内部会智能更新isInsideAliveRegion
      generatePopoverFromLink(anchor) 
      //该函数内含竞态，若竞态成功，则currentActivePopoverNode会被更新为新生成的popover
      //isInsideAliveRegion也会被更新为true
      //如果竞态失败，则currentActivePopoverNode和isInsideAliveRegion不被更新
    }
    else if (!currentActivePopoverNode){
      clearLeaveAliveRegionTimer()
      generatePopoverFromLink(anchor)
    }
    return //既然是精准地在anchor上而非粗泛的某个popover区域，那执行完就可以撤退了
  }


  if (popover && currentActivePopoverNode === popover) {
    clearLeaveAliveRegionTimer()
  }

  if (currentActivePopoverNode) {
    setLeaveAliveRegionTimer()
  }
}

function getThePopoverMouseIsAt({mouseX, mouseY}: {mouseX: number, mouseY: number}): PopoverNode | null {
  let node: PopoverNode | null = currentActivePopoverNode
  while (node) {
    const rect = node.element.getBoundingClientRect()
    if (mouseX !== undefined && 
        mouseY !== undefined && 
        mouseX >= rect.left && 
        mouseX <= rect.right && 
        mouseY >= rect.top && 
        mouseY <= rect.bottom
    ) {
      return node
    }
    node = node.parent
  }
  return null
}

function destroyPopover(node: PopoverNode) {
  node.element.remove()
  deleteNodeFromPopovers(node)
}

//return当前所在popover,如果不在任何popover内则返回null
function detectAndDestroy() {
  
  if (leaveAliveRegionTimer) {
    clearTimeout(leaveAliveRegionTimer)
    leaveAliveRegionTimer = null
  }

  currentActivePopoverNode = getThePopoverMouseIsAt({mouseX, mouseY})

  if (!currentActivePopoverNode) {
    // 鼠标不在任何 popover 上，销毁全部
    for (const [, node] of popovers) {
      if (node.pinned) continue
      destroyPopover(node)
    }
    activeAnchor = null  //一旦发起了detectAndDestroy，所有还在fetch中的链接全部终止fetch
    return
  }

  let child = currentActivePopoverNode.child
  while (child) {
    if (child.pinned) {
      child = child.child
      continue
    }
    const next = child.child
    destroyPopover(child)
    child = next
  }
  currentActivePopoverNode.child = null
  activeAnchor = null  //一旦发起了detectAndDestroy，所有还在fetch中的链接全部终止fetch

  if (currentActivePopoverNode) {
    currentActivePopoverNode.element.classList.add("active-popover")
  }
}


async function generatePopoverFromLink(link: HTMLAnchorElement): Promise<PopoverNode | null> {
  if (pendingFetchLinks.has(link)) return null

  pendingFetchLinks.add(link)
  try {

  activeAnchor = link

  if (link.dataset.noPopover === "true") return null

  const targetUrl = new URL(link.href) 
  //link是HTMLAnchorElement对象，其href属性是完整URL,由浏览器补全
  //如果是上面的el.getAttribute("href")，则获取到的就是原始的相对路径（./...或者/...），不会自动补全为完整URL

  const response = await fetchCanonical(targetUrl).catch(() => {})
  if (!response) return null
  if (activeAnchor !== link) return null

  const rawContentType = response.headers.get("Content-Type")
  if (!rawContentType) return null

  const contents = await response.text()
  if (activeAnchor !== link) return null

  //从此处起不再有异步操作，不再判断竞态，直接一撸到底

  const html = domParser.parseFromString(contents, "text/html")
  normalizeRelativeURLs(html, targetUrl)
  const popoverId = crypto.randomUUID()
  html.querySelectorAll("[id]").forEach((el) => {
    el.id = `popover-${popoverId}-${el.id}`
  })
  const elts = [...html.getElementsByClassName("popover-hint")] //内容裁剪
  if (elts.length === 0) return null

  //装载dom元素，准备弹窗显示
  const popoverEl = document.createElement("div")
  popoverEl.classList.add("popover")
  popoverEl.style.position = "fixed"

  //工具栏
  const toolbar = document.createElement("div")
  toolbar.classList.add("popover-toolbar")
  const pinBtn = document.createElement("button")
  pinBtn.classList.add("toolbar-pin-btn")
  pinBtn.innerHTML = iconPin
  const closeBtn = document.createElement("button")
  closeBtn.classList.add("toolbar-close-btn")
  closeBtn.innerHTML = iconClose
  const spacer = document.createElement("div")
  spacer.classList.add("toolbar-spacer")
  toolbar.appendChild(pinBtn)

  const maximizeBtn = document.createElement("button")
  maximizeBtn.classList.add("toolbar-maximize-btn")
  maximizeBtn.innerHTML = iconMaximize
  toolbar.appendChild(maximizeBtn)

  toolbar.appendChild(spacer)
  toolbar.appendChild(closeBtn)
  closeBtn.style.display = "none"

  popoverEl.appendChild(toolbar)

  const inner = document.createElement("div")
  inner.classList.add("popover-inner")
  const content = document.createElement("div")
  content.classList.add("popover-content")
  elts.forEach((elt) => content.appendChild(elt))
  inner.appendChild(content)
  popoverEl.appendChild(inner)
  document.body.appendChild(popoverEl)

  //计算popover位置
  const { x, y } = await computePosition(link, popoverEl, {
    strategy: "fixed",
    middleware: [offset(8), autoPlacement(), shift(), flip()],
  })
  Object.assign(popoverEl.style, {
    transform: `translate(${x.toFixed()}px, ${y.toFixed()}px)`,
  })

  const node = new PopoverNode(
    popoverId,
    popoverEl,
    targetUrl.toString(),
    link,
  )
  insertNodeIntoPopovers(node)
  //切换 active-popover class
  if (currentActivePopoverNode) {
    currentActivePopoverNode.element.classList.remove("active-popover")
  }
  currentActivePopoverNode = node
  node.element.classList.add("active-popover")

  //工具栏拖动事件
  toolbar.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return
    e.preventDefault()
    currentActivePopoverNode = node
    node.pinned = true
    node.element.classList.add("pinned")
    closeBtn.style.display = ""
    pinBtn.innerHTML = iconPinFilled
    isDragging = true
    dragTarget = node
    const rect = node.element.getBoundingClientRect()
    dragOffsetX = e.clientX - rect.left
    dragOffsetY = e.clientY - rect.top
  })

  //pin 按钮点击：切换 pin/unpin
  pinBtn.addEventListener("click", () => {
    currentActivePopoverNode = node
    node.pinned = !node.pinned
    node.element.classList.toggle("pinned", node.pinned)
    closeBtn.style.display = node.pinned ? "" : "none"
    pinBtn.innerHTML = node.pinned ? iconPinFilled : iconPin
  })

  //close 按钮点击
  closeBtn.addEventListener("click", () => {
    destroyPopover(node)
  })

  //maximize 按钮点击
  maximizeBtn.addEventListener("click", () => {
    window.open(node.url, "_blank")
  })

  //resize：鼠标靠近内侧边缘时改变光标，按下时开始拖拽调整大小
  popoverEl.addEventListener("mousemove", (e) => {
    if (isDragging || isResizing) return
    const rect = popoverEl.getBoundingClientRect()
    const onLeft = e.clientX >= rect.left && e.clientX <= rect.left + 10
    const onRight = e.clientX >= rect.right - 10 && e.clientX <= rect.right
    const onTop = e.clientY >= rect.top && e.clientY <= rect.top + 10
    const onBottom = e.clientY >= rect.bottom - 10 && e.clientY <= rect.bottom
    popoverEl.style.cursor =
      (onLeft && onTop) ? "nwse-resize" :
      (onRight && onBottom) ? "nwse-resize" :
      (onRight && onTop) ? "nesw-resize" :
      (onLeft && onBottom) ? "nesw-resize" :
      onLeft ? "ew-resize" :
      onRight ? "ew-resize" :
      onTop ? "ns-resize" :
      onBottom ? "ns-resize" : ""
  })

  popoverEl.addEventListener("mousedown", (e) => {
    if (isDragging) return
    const rect = popoverEl.getBoundingClientRect()
    const onLeft = e.clientX >= rect.left && e.clientX <= rect.left + 10
    const onRight = e.clientX >= rect.right - 10 && e.clientX <= rect.right
    const onTop = e.clientY >= rect.top && e.clientY <= rect.top + 10
    const onBottom = e.clientY >= rect.bottom - 10 && e.clientY <= rect.bottom
    if (!onLeft && !onRight && !onTop && !onBottom) return
    e.preventDefault()
    currentActivePopoverNode = node
    node.pinned = true
    node.element.classList.add("pinned")
    closeBtn.style.display = ""
    pinBtn.innerHTML = iconPinFilled
    isResizing = true
    resizeTarget = node
    resizeStartX = e.clientX
    resizeStartY = e.clientY
    resizeStartWidth = rect.width
    resizeStartHeight = rect.height
    resizeAnchorLeft = onLeft
    resizeAnchorTop = onTop
    //记录初始 transform 位置，用于对角固定
    const transform = popoverEl.style.transform
    const match = transform.match(/translate\((.+?)px,\s*(.+?)px\)/)
    resizeStartTranslateX = match ? parseFloat(match[1]) : rect.left
    resizeStartTranslateY = match ? parseFloat(match[2]) : rect.top
  })

  popoverEl.classList.add("active-popover")

  return node

  } finally {
    pendingFetchLinks.delete(link)
  }
}

function setup() {
  //SPA导航时清理所有现存弹窗和状态
  for (const [, node] of popovers) {
    destroyPopover(node)
  }
  currentActivePopoverNode = null
  activeAnchor = null
  leaveAliveRegionTimer = null
  pendingFetchLinks.clear()
  isDragging = false
  dragTarget = null
  isResizing = false
  resizeTarget = null

  document.addEventListener("mousemove", handleMouseMove)
  document.addEventListener("mousemove", onDragMove)
  document.addEventListener("mousemove", onResizeMove)
  document.addEventListener("mouseup", onDragEnd)
  document.addEventListener("mouseup", onResizeEnd)

  window.addCleanup(() => {
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mousemove", onDragMove)
    document.removeEventListener("mousemove", onResizeMove)
    document.removeEventListener("mouseup", onDragEnd)
    document.removeEventListener("mouseup", onResizeEnd)
  })
}

document.addEventListener("nav", setup)
document.addEventListener("render", setup)


