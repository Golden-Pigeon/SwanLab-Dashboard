<template>
  <section class="w-screen h-screen overflow-x-clip">
    <!-- 侧边栏关闭/开启按钮 -->
    <button class="close-button" ref="cbRef" :style="closeButtonStyle" @click="handleClose" v-if="showSideBar">
      <SLIcon icon="sidebar" class="w-full h-full" />
    </button>
    <!-- 顶部header -->
    <header class="h-14 w-full">
      <HeaderBar :version="version" />
    </header>
    <!-- 下半部分主要内容，增加一个relative-container的原因是解决按钮在滑动时的隐藏问题 -->
    <main class="main-container">
      <!-- 遮罩，淡入淡出 -->
      <transition name="fade" v-if="showSideBar">
        <div class="md:hidden sidebar-overlay" v-if="isSideBarShow" @click="handleClose"></div>
      </transition>
      <!-- 侧边栏 -->
      <div
        class="sidebar-container bg-default"
        :class="{ 'is-resizing': isResizing }"
        ref="sidebarRef"
        v-if="showSideBar"
      >
        <!-- 侧边栏规定宽度（可拖拽调整） -->
        <div class="sidebar-content" :style="{ width: sidebarWidth + 'px' }">
          <SideBar />
        </div>
      </div>
      <!-- 侧边栏宽度拖拽手柄（仅大屏、且侧边栏展开时可用） -->
      <div
        v-if="showSideBar && isSideBarShow"
        class="sidebar-resizer hidden md:block"
        :class="{ 'is-resizing': isResizing }"
        :style="{ left: sidebarWidth + 'px' }"
        @mousedown="startResize"
      ></div>
      <!-- 右侧主要内容 -->
      <div class="main-content border-l" ref="containerRef">
        <slot></slot>
      </div>
    </main>
  </section>
</template>
<script setup>
/**
 * MainContentLayout - 页面布局，包含sidebar和右侧部分，用于展示页面内容
 * 右侧部分可以通过传入的props定义是否显示
 */
import { ref, watch, onMounted, onBeforeUnmount, provide, computed } from 'vue'
import HeaderBar from './components/HeaderBar.vue'
import SideBar from './components/SideBar.vue'
import { useRoute } from 'vue-router'
const props = defineProps({
  version: {
    type: String,
    default: 'unknown'
  },
  showSideBar: {
    type: Boolean,
    default: true
  }
})

// ---------------------------------- 开启/关闭sidebar ----------------------------------

const cbRef = ref(null)
/**
 * 是否是小屏幕，这意味着isSideBarShow在初始化的时候是否为false，如果为false，那么侧边栏将不会显示
 * 后续考虑改为响应式
 */
const threshold = 768
const isSmallScreen = ref(window.innerWidth < threshold)
const handleWindowResize = () => {
  isSmallScreen.value = window.innerWidth < threshold
}
window.addEventListener('resize', handleWindowResize)

// 是否显示主布局的sideBar，可以监听，主要用于实现MainContent和MainHeader之间的交互动画
const isSideBarShow = ref(!isSmallScreen.value)
// 注入isSideBarShow，内部插槽可以通过inject('isSideBarShow')获取到isSideBarShow的值，但是不可以修改
provide(
  'isSideBarShow',
  computed(() => isSideBarShow.value)
)

// 如果需要修改，通过下面注入的openSideBar和closeSideBar方法完成，这两个方法如果被内部组件调用，自动检测是否是小屏幕，如果不是小屏幕，不执行任何操作
provide('openSideBar', () => {
  if (isSmallScreen.value) {
    isSideBarShow.value = true
  }
})
provide('closeSideBar', () => {
  if (isSmallScreen.value) {
    isSideBarShow.value = false
  }
})

// 关闭按钮点击事件
const handleClose = () => {
  isSideBarShow.value = !isSideBarShow.value
}

// ---------------------------------- 其他对象 ----------------------------------

const sidebarRef = ref(null)
const containerRef = ref(null)

// ---------------------------------- 侧边栏宽度：可拖拽 + 本地持久化 ----------------------------------

const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 640
const DEFAULT_SIDEBAR_WIDTH = 288
const SIDEBAR_WIDTH_KEY = 'fastsl-sidebar-width'

const clampWidth = (w) => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, w))

const loadSidebarWidth = () => {
  const stored = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY), 10)
  return Number.isFinite(stored) ? clampWidth(stored) : DEFAULT_SIDEBAR_WIDTH
}

const sidebarWidth = ref(loadSidebarWidth())
const isResizing = ref(false)
let stopResize = null

// 关闭按钮位置跟随侧边栏宽度（打开状态），24 为按钮尺寸，16 为右侧留白
const closeButtonStyle = computed(() => ({
  left: sidebarWidth.value - 24 - 16 + 'px'
}))

// 将当前宽度应用到侧边栏容器（仅在展开时）
const applySidebarWidth = () => {
  if (!props.showSideBar || !sidebarRef.value) return
  if (isSideBarShow.value) sidebarRef.value.style.width = sidebarWidth.value + 'px'
}

const startResize = (e) => {
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'

  const onMove = (ev) => {
    sidebarWidth.value = clampWidth(startWidth + (ev.clientX - startX))
  }
  const onUp = () => {
    isResizing.value = false
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value))
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    stopResize = null
  }
  stopResize = onUp
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// 宽度变化时实时同步到容器
watch(sidebarWidth, applySidebarWidth)

// ---------------------------------- 注册挂载钩子 ----------------------------------

onMounted(() => {
  watch(
    isSideBarShow,
    (val) => {
      if (!props.showSideBar) return
      // 显示
      if (val) {
        sidebarRef.value.style.width = sidebarWidth.value + 'px'
        cbRef.value.classList.remove('close-button-sidebar-close')
        cbRef.value.classList.add('close-button-sidebar-open')
      } else {
        sidebarRef.value.style.width = '0'
        cbRef.value.classList.remove('close-button-sidebar-open')
        cbRef.value.classList.add('close-button-sidebar-close')
      }
    },
    {
      immediate: true
    }
  )
})

// ---------------------------------- 路由更改时，判断是否是小屏幕，如果是，隐藏sidebar ----------------------------------

const route = useRoute()
watch(
  computed(() => route.fullPath),
  () => {
    if (isSmallScreen.value) {
      isSideBarShow.value = false
    }
  }
)
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  stopResize?.()
})

// ---------------------------------- 暴露对象 ----------------------------------

defineExpose({
  containerRef
})
</script>

<style lang="scss" scoped>
$open-top: 72px;
$close-top: 17px;

// 动画持续时间
$duration: 400ms;

// 关闭按钮
$close-button-size: 24px;

// 侧边栏宽度，需要与上面js中设置的宽度一致
$sidebar-width: 288px;

// 除去header的高度
$main-content-height: calc(100vh - 56px);

.relative-container {
  @apply relative overflow-y-hidden;
  height: $main-content-height;
}
.main-container {
  @apply relative w-screen flex  overflow-auto;
  height: $main-content-height;

  .main-content {
    @apply h-full w-full overflow-y-auto overflow-x-hidden;
    // 宽度变化
    transition: width $duration ease-in-out;
  }
}

// 侧边栏宽度拖拽手柄
.sidebar-resizer {
  @apply absolute top-0 z-full h-full;
  width: 6px;
  // 让手柄居中骑在侧边栏与内容的分界线上
  transform: translateX(-3px);
  cursor: col-resize;

  &::after {
    content: '';
    @apply absolute inset-y-0 left-1/2 w-px -translate-x-1/2;
    background-color: transparent;
    transition: background-color 150ms ease;
  }
  &:hover::after,
  &.is-resizing::after {
    background-color: var(--primary-default);
  }
}

.close-button {
  @apply absolute z-full outline-none border-none rounded p-1 bg-transparent;
  transition-duration: $duration;
  transition-timing-function: ease-in-out;
  transition-property: top, color, transform, background-color;
  width: $close-button-size;
  height: $close-button-size;
  left: calc($sidebar-width - $close-button-size - 16px);
}

// sidebar被关闭
.close-button-sidebar-close {
  top: $close-top;
  color: var(--accent-white-highest);
  transform: translateX(-108px) rotateY(180deg);
  &:hover {
    @apply text-white-default;
  }
}

// sidebar开启时
.close-button-sidebar-open {
  top: $open-top;
  &:hover {
    @apply bg-highest;
  }
}

// 定义一个动画，$duration秒之内不透明度从1到0再到1
@keyframes closeOpen {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.close-button-enter-active,
.close-button-leave-active {
  animation: closeOpen $duration ease-in-out;
}

// 遮罩
.sidebar-overlay {
  @apply absolute w-full  overflow-x-hidden z-40;
  height: $main-content-height;
  background-color: var(--background-overlay);
  animation: fadeIn $duration ease;
}
// sidebar容器
.sidebar-container {
  @apply z-50 box-content  md:h-full overflow-y-auto overflow-x-clip flex-shrink-0 md:static absolute;
  height: $main-content-height;
  // 宽度变化
  transition: width $duration ease-in-out;
  // 拖拽调整宽度时关闭过渡，避免跟手延迟
  &.is-resizing {
    transition: none;
  }
  // 将滚动条隐藏
  &::-webkit-scrollbar {
    display: none; /* 隐藏WebKit浏览器的滚动条 */
  }

  .sidebar-content {
    @apply h-full;
    width: $sidebar-width;
  }
}

// 淡出
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-leave-to {
  opacity: 0;
}

// 淡入
@keyframes fadeIn {
  from {
    opacity: 0; /* 从完全透明开始 */
  }
  to {
    opacity: 1; /* 渐变到完全不透明 */
  }
}
</style>
