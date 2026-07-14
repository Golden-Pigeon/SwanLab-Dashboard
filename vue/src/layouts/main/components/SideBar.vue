<template>
  <!-- 侧边栏区域 -->
  <div class="flex flex-col grow h-full bg-higher">
    <!-- 概览区域 -->
    <div class="p-4 flex flex-col border-b gap-2 font-semibold">
      <!-- 项目信息 -->
      <h1 class="font-semibold mb-1">{{ $t('common.sidebar.project.title') }}</h1>
      <RouterLink to="/" active-class="active-link">
        <SLIcon icon="runs" class="w-4 h-4 mr-2" />
        <span>{{ $t('common.sidebar.project.runs') }}</span>
      </RouterLink>
      <RouterLink to="/charts" active-class="active-link">
        <SLIcon icon="charts" class="w-4 h-4 mr-2" />
        <span>{{ $t('common.sidebar.project.charts') }}</span>
      </RouterLink>
    </div>
    <!-- 对比分组面板（图表/表格入口之下、实验列表之上） -->
    <GroupPanel />
    <!-- 实验路由 -->
    <div class="experiments-container" ref="expContainerRef">
      <div class="flex flex-col gap-4 sticky top-0 bg-higher py-4 -mb-4">
        <div class="flex items-center gap-1.5">
          <h1 class="font-semibold">{{ $t('common.sidebar.experiments.title') }}</h1>
          <span class="font-semibold px-3 text-sm bg-highest rounded-full">{{ totalExperiments }}</span>
        </div>
        <SLSearch @input="search" reverse :placeholder="$t('common.search.placeholder')" />
      </div>
      <!-- 实验列表 -->
      <RouterLink
        v-for="experiment in experiments"
        :key="experiment.id"
        :to="getExperimentRouter(experiment)"
        :title="experiment.name"
        class="experiment-link"
        active-class="active-link"
      >
        <!-- 运行中的实验：圆点呼吸式闪烁代替“(运行中)”文字 -->
        <circle
          class="w-4 h-4 rounded-full mr-3 flex-shrink-0"
          :class="{ 'is-running': experiment.status === 0 }"
          :style="{ backgroundColor: getExperimentColor(experiment) }"
        />
        <!-- 别名就地编辑：编辑中显示输入框，否则显示别名(或原始名称) -->
        <input
          v-if="editingId === experiment.id"
          :ref="(el) => bindAliasInput(el, experiment.id)"
          v-model="editingValue"
          class="alias-input"
          :placeholder="experiment.name"
          @click.prevent.stop
          @keyup.enter="saveAlias(experiment)"
          @keyup.esc="cancelAlias"
          @blur="saveAlias(experiment)"
        />
        <span v-else class="truncate min-w-0">{{ fastslStore.displayName(experiment) }}</span>
        <!-- 更多信息，进入此容器后不触发父容器所有效果(包括hover、active的css效果) -->
        <div class="more-info" @click.prevent @mouseenter="removeHover" @mouseleave="resetHover">
          <!-- 别名编辑按钮（hover 显示） -->
          <button class="alias-button" title="别名" @click="startAlias(experiment)">✎</button>
          <!-- 加入分组：可编辑下拉框，输入命中已有分组则加入，否则按输入新建 -->
          <div class="group-picker-wrap" @click.prevent.stop>
            <button
              class="group-add-trigger"
              :class="{ 'is-open': groupPickerId === experiment.id }"
              title="加入分组"
              @click="openGroupPicker(experiment)"
            >
              +
            </button>
            <div v-if="groupPickerId === experiment.id" class="group-picker">
              <input
                :ref="(el) => bindGroupInput(el, experiment.id)"
                v-model="groupQuery"
                class="group-picker-input"
                placeholder="选择或输入分组名"
                @keyup.enter="confirmGroup(experiment)"
                @keyup.esc="closeGroupPicker"
              />
              <ul class="group-picker-list">
                <li v-for="g in filteredGroups" :key="g.id" class="group-picker-item" @click="joinGroup(g, experiment)">
                  <span class="truncate">{{ g.name }}</span>
                  <span v-if="isMember(g, experiment)" class="member-tag">已加入</span>
                </li>
                <li v-if="canCreateGroup" class="group-picker-item create-item" @click="createGroupWith(experiment)">
                  ＋ 新建“{{ groupQuery.trim() }}”
                </li>
                <li v-if="!filteredGroups.length && !canCreateGroup" class="group-picker-empty">暂无分组</li>
              </ul>
            </div>
          </div>
          <!-- 如果在charts页面，显示眼睛 -->
          <button class="show-button" v-if="$route.path == '/charts'" @click="changeExperimentShow(experiment.id)">
            <SLIcon icon="eye" class="w-full h-full" v-if="experiment.show" />
            <SLIcon icon="eye-close" class="w-full h-full text-dimmest" v-else />
          </button>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
/**
 * @description: 侧边栏导航
 * @file: HomeSiderBar.vue
 * @since: 2023-12-04 18:20:02
 **/
import SLIcon from '@swanlab-vue/components/SLIcon.vue'
import SLSearch from '@swanlab-vue/components/SLSearch.vue'
import GroupPanel from './GroupPanel.vue'
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { useProjectStore, useFastslStore } from '@swanlab-vue/store'
import http from '@swanlab-vue/api/http'
import { debounces } from '@swanlab-vue/utils/common'

const projectStore = useProjectStore()
const fastslStore = useFastslStore()
// ---------------------------------- 实验id转路由 ----------------------------------
const getExperimentRouter = (experiment) => {
  return `/experiment/${experiment.id}`
}

// ---------------------------------- 搜索实验 ----------------------------------

// 需要展示的实验信息——默认展示全部，但在搜索过后，更新为搜索结果
const experiments = computed(() => {
  if (!searchValue.value) return projectStore.experiments
  // 搜索同时匹配原始名称与别名
  return projectStore.experiments.filter(
    (expr) =>
      expr.name.toLowerCase().includes(searchValue.value) ||
      fastslStore.displayName(expr).toLowerCase().includes(searchValue.value)
  )
})

const searchValue = ref('')

const search = (value) => {
  searchValue.value = value.toLowerCase()
}

// ---------------------------------- 获取实验颜色 ----------------------------------
const getExperimentColor = (experiment) => {
  return experiment.light
}

// ---------------------------------- 计算实验数量，也包括可视实验数量 ----------------------------------

const totalExperiments = computed(() => {
  return projectStore.experiments.length
})

// ---------------------------------- 项目图表界面下，点击眼睛后的效果 ----------------------------------
const path = debounces((id, show) => {
  http.patch('/experiment/' + id + '/show', {
    show
  })
}, 500)
const changeExperimentShow = (id) => {
  const show = projectStore.changeExperimentShow(id)
  // 请求后端更新，直接更新store后请求，不需要等待
  path(id, show)
}

// ---------------------------------- 进入more-info部分，将父元素hover效果移除 ----------------------------------
const removeHover = (e) => {
  // console.log('进入', e.target.parentNode)
  const parent = e.target.parentNode
  parent.classList.add('!bg-transparent')
}
const resetHover = (e) => {
  // console.log('离开', e.target.parentNode)
  const parent = e.target.parentNode
  parent.classList.remove('!bg-transparent')
}

// ---------------------------------- 别名就地编辑 ----------------------------------
const editingId = ref(null)
const editingValue = ref('')
let aliasInputEl = null
const bindAliasInput = (el, id) => {
  if (el && editingId.value === id) aliasInputEl = el
}
const startAlias = (experiment) => {
  editingId.value = experiment.id
  editingValue.value = fastslStore.aliases[experiment.run_id] || ''
  nextTick(() => aliasInputEl?.focus())
}
const cancelAlias = () => {
  editingId.value = null
}
// 保存别名：空串清除，恢复原始名称
const saveAlias = async (experiment) => {
  if (editingId.value !== experiment.id) return
  const val = editingValue.value
  editingId.value = null
  try {
    await fastslStore.setAlias(experiment.run_id, val)
  } catch (e) {
    console.warn('[fastsl] set alias failed', e)
  }
}

// ---------------------------------- 加入分组：可编辑下拉框 ----------------------------------
const groupPickerId = ref(null) // 当前打开下拉框的实验 id
const groupQuery = ref('')
let groupInputEl = null
const bindGroupInput = (el, id) => {
  if (el && groupPickerId.value === id) groupInputEl = el
}

// 按输入过滤已有分组（空输入展示全部）
const filteredGroups = computed(() => {
  const q = groupQuery.value.trim().toLowerCase()
  if (!q) return fastslStore.groups
  return fastslStore.groups.filter((g) => g.name.toLowerCase().includes(q))
})

// 输入非空且不与已有分组同名时，可新建
const canCreateGroup = computed(() => {
  const q = groupQuery.value.trim()
  if (!q) return false
  return !fastslStore.groups.some((g) => g.name.toLowerCase() === q.toLowerCase())
})

const isMember = (g, experiment) => g.members?.includes(experiment.run_id)

const openGroupPicker = (experiment) => {
  editingId.value = null // 关闭别名编辑，避免叠加
  groupPickerId.value = experiment.id
  groupQuery.value = ''
  document.addEventListener('mousedown', onGroupPickerOutside)
  nextTick(() => groupInputEl?.focus())
}
const closeGroupPicker = () => {
  groupPickerId.value = null
  groupQuery.value = ''
  document.removeEventListener('mousedown', onGroupPickerOutside)
}
// 点击下拉框外部时关闭
const onGroupPickerOutside = (e) => {
  if (!e.target.closest || !e.target.closest('.group-picker-wrap')) closeGroupPicker()
}

const joinGroup = async (g, experiment) => {
  try {
    await fastslStore.addMember(g.id, experiment.run_id)
  } catch (e) {
    console.warn('[fastsl] add member failed', e)
  }
  closeGroupPicker()
}
const createGroupWith = async (experiment) => {
  const name = groupQuery.value.trim()
  if (!name) return
  try {
    await fastslStore.createGroup(name, [experiment.run_id])
  } catch (e) {
    console.warn('[fastsl] create group failed', e)
  }
  closeGroupPicker()
}
// 回车：精确命中已有分组则加入，否则按输入新建；空输入且只有一个候选时加入该候选
const confirmGroup = (experiment) => {
  const name = groupQuery.value.trim()
  if (!name) {
    if (filteredGroups.value.length === 1) joinGroup(filteredGroups.value[0], experiment)
    return
  }
  const exact = fastslStore.groups.find((g) => g.name.toLowerCase() === name.toLowerCase())
  if (exact) joinGroup(exact, experiment)
  else createGroupWith(experiment)
}

onBeforeUnmount(() => document.removeEventListener('mousedown', onGroupPickerOutside))
</script>

<style lang="scss" scoped>
// RouterLink共享样式
a {
  @apply flex items-center px-4 h-9 text-default hover:bg-highest rounded-lg;
}

.active-link {
  @apply bg-highest text-default cursor-default;
}

.experiments-container {
  @apply flex flex-col p-4 pt-0 grow gap-4 overflow-auto;
  &::-webkit-scrollbar-track {
    background: transparent;
  }

  // 实验链接样式
  .experiment-link {
    @apply flex-shrink-0 text-base pr-0;
    .more-info {
      @apply flex flex-nowrap justify-end grow text-primary-default pr-4 gap-2 cursor-default whitespace-nowrap;
      .show-button {
        @apply w-7 h-6 p-1 rounded;
        &:hover {
          @apply text-primary-highest bg-highest;
        }
      }
      // 别名按钮：默认隐藏，hover 到该行才出现
      .alias-button {
        @apply w-7 h-6 p-1 rounded opacity-0 leading-none flex items-center justify-center;
        &:hover {
          @apply text-primary-highest bg-highest;
        }
      }
      // 加入分组触发器：默认隐藏，hover 到该行才出现；下拉框打开时保持可见
      .group-add-trigger {
        @apply w-7 h-6 rounded opacity-0 leading-none flex items-center justify-center;
        &:hover {
          @apply text-primary-highest bg-highest;
        }
        &.is-open {
          @apply opacity-100;
        }
      }
      // 加入分组下拉框
      .group-picker-wrap {
        @apply relative flex items-center;
      }
      .group-picker {
        @apply absolute right-0 top-full mt-1 z-full rounded border bg-default;
        width: 190px;
        box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.1);
        .group-picker-input {
          @apply w-full px-2 py-1.5 text-sm bg-transparent border-b outline-none text-default;
        }
        .group-picker-list {
          @apply py-1 overflow-auto;
          max-height: 200px;
        }
        .group-picker-item {
          @apply flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-default cursor-pointer;
          &:hover {
            @apply bg-highest;
          }
          .member-tag {
            @apply text-xs text-dimmest flex-shrink-0;
          }
        }
        .create-item {
          @apply text-primary-default;
        }
        .group-picker-empty {
          @apply px-2 py-1.5 text-sm text-dimmest;
        }
      }
    }
    &:hover .more-info .alias-button,
    &:hover .more-info .group-add-trigger {
      @apply opacity-100;
    }
    // 别名就地编辑输入框
    .alias-input {
      @apply min-w-0 grow bg-transparent border-b border-primary-default outline-none;
    }
  }
}

// 运行中实验的圆点：呼吸式闪烁
.is-running {
  animation: breathing 1.6s ease-in-out infinite;
}
@keyframes breathing {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.3;
    transform: scale(0.82);
  }
}
</style>
