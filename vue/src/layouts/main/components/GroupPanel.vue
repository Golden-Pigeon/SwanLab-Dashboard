<template>
  <div class="group-panel">
    <!-- 标题 + 新建分组 -->
    <div class="flex items-center gap-1.5">
      <h1 class="font-semibold">对比分组</h1>
      <span class="font-semibold px-3 text-sm bg-highest rounded-full">{{ fastslStore.groups.length }}</span>
      <button class="ml-auto add-group-btn" title="新建分组" @click="startCreate">＋</button>
    </div>

    <!-- 新建分组的就地输入 -->
    <input
      v-if="creating"
      ref="createInputRef"
      v-model="createName"
      class="group-input"
      placeholder="分组名称，回车创建"
      @keyup.enter="confirmCreate"
      @keyup.esc="creating = false"
      @blur="creating = false"
    />

    <!-- 分组列表 -->
    <div class="flex flex-col" v-for="g in fastslStore.groups" :key="g.id">
      <div class="group-row">
        <button class="expand-btn" @click="toggle(g.id)">{{ expanded[g.id] ? '▾' : '▸' }}</button>
        <!-- 改名中显示输入框 -->
        <input
          v-if="renamingId === g.id"
          :ref="(el) => bindRenameInput(el, g.id)"
          v-model="renameValue"
          class="group-input grow"
          @keyup.enter="confirmRename(g)"
          @keyup.esc="renamingId = null"
          @blur="confirmRename(g)"
        />
        <RouterLink v-else class="grow truncate group-link" :to="`/group/${g.id}`" :title="g.name">
          {{ g.name }}
        </RouterLink>
        <span class="text-xs text-dimmer">({{ g.members.length }})</span>
        <div class="group-actions">
          <button title="改名" aria-label="修改分组名称" @click="startRename(g)">✎</button>
          <button title="删除分组" aria-label="删除分组" @click="deleteGroup(g)">🗑</button>
        </div>
      </div>

      <!-- 展开：成员 + 添加 -->
      <div v-if="expanded[g.id]" class="members">
        <div class="member-row" v-for="runId in g.members" :key="runId">
          <span class="grow truncate" :title="memberName(runId)">· {{ memberName(runId) }}</span>
          <button class="member-remove" title="移出分组" aria-label="移出分组" @click="removeMember(g.id, runId)">
            ✕
          </button>
        </div>
        <button class="add-member-btn" @click="openAddDialog(g)">＋ 添加</button>
      </div>
    </div>

    <!-- 添加成员搜索对话框 -->
    <SLModal v-model="addDialogVisible" class="p-6 flex flex-col gap-3" maxW="480">
      <h1 class="text-lg font-semibold">添加实验到「{{ addTarget?.name }}」</h1>
      <SLSearch @input="(v) => (addSearch = v.toLowerCase())" :placeholder="'搜索实验名或别名'" />
      <div class="add-list">
        <label class="add-item" v-for="exp in candidates" :key="exp.run_id">
          <span class="truncate" :title="fastslStore.displayName(exp)">{{ fastslStore.displayName(exp) }}</span>
          <button class="add-item-btn" @click="addExp(exp)">加入</button>
        </label>
        <p v-if="!candidates.length" class="text-dimmer text-sm text-center py-4">没有可添加的实验</p>
      </div>
    </SLModal>
  </div>
</template>

<script setup>
/**
 * @description: fastsl 对比分组面板。位于侧边栏「图表/表格入口」之下、实验列表之上。
 * 支持新建/改名/删除分组、展开查看成员、移除成员、搜索添加成员。所有改动即时持久化。
 * @file: GroupPanel.vue
 **/
import { ref, computed, nextTick } from 'vue'
import { RouterLink } from 'vue-router'
import { useProjectStore, useFastslStore } from '@swanlab-vue/store'
import SLModal from '@swanlab-vue/components/SLModal.vue'
import SLSearch from '@swanlab-vue/components/SLSearch.vue'

const projectStore = useProjectStore()
const fastslStore = useFastslStore()

// ---------------------------------- 展开/折叠 ----------------------------------
const expanded = ref({})
const toggle = (gid) => {
  expanded.value = { ...expanded.value, [gid]: !expanded.value[gid] }
}

// 成员 run_id -> 显示名
const expByRunId = (runId) => projectStore.experiments?.find((e) => e.run_id === runId)
const memberName = (runId) => {
  const exp = expByRunId(runId)
  return exp ? fastslStore.displayName(exp) : runId
}

// ---------------------------------- 新建分组 ----------------------------------
const creating = ref(false)
const createName = ref('')
const createInputRef = ref(null)
const startCreate = () => {
  creating.value = true
  createName.value = ''
  nextTick(() => createInputRef.value?.focus())
}
const confirmCreate = async () => {
  const name = createName.value.trim()
  creating.value = false
  if (!name) return
  try {
    await fastslStore.createGroup(name)
  } catch (e) {
    console.warn('[fastsl] create group failed', e)
  }
}

// ---------------------------------- 改名 ----------------------------------
const renamingId = ref(null)
const renameValue = ref('')
let renameInputEl = null
const bindRenameInput = (el, id) => {
  if (el && renamingId.value === id) renameInputEl = el
}
const startRename = (g) => {
  renamingId.value = g.id
  renameValue.value = g.name
  nextTick(() => renameInputEl?.focus())
}
const confirmRename = async (g) => {
  if (renamingId.value !== g.id) return
  const name = renameValue.value.trim()
  renamingId.value = null
  if (!name || name === g.name) return
  try {
    await fastslStore.renameGroup(g.id, name)
  } catch (e) {
    console.warn('[fastsl] rename group failed', e)
  }
}

const deleteGroup = async (g) => {
  if (!window.confirm(`确定删除分组“${g.name}”吗？`)) return
  try {
    await fastslStore.deleteGroup(g.id)
  } catch (e) {
    console.warn('[fastsl] delete group failed', e)
  }
}
const removeMember = async (gid, runId) => {
  try {
    await fastslStore.removeMember(gid, runId)
  } catch (e) {
    console.warn('[fastsl] remove member failed', e)
  }
}

// ---------------------------------- 添加成员对话框 ----------------------------------
const addDialogVisible = ref(false)
const addTarget = ref(null)
const addSearch = ref('')
const openAddDialog = (g) => {
  addTarget.value = g
  addSearch.value = ''
  addDialogVisible.value = true
}
// 候选：不在该组、且匹配搜索词
const candidates = computed(() => {
  const g = addTarget.value
  if (!g) return []
  const members = new Set(g.members)
  return (projectStore.experiments || []).filter((exp) => {
    if (members.has(exp.run_id)) return false
    if (!addSearch.value) return true
    return (
      exp.name.toLowerCase().includes(addSearch.value) ||
      fastslStore.displayName(exp).toLowerCase().includes(addSearch.value)
    )
  })
})
const addExp = async (exp) => {
  const g = addTarget.value
  if (!g) return
  try {
    await fastslStore.addMember(g.id, exp.run_id)
    // addTarget 引用 store 中的对象副本，刷新为最新以更新候选列表
    addTarget.value = fastslStore.groups.find((x) => x.id === g.id) || g
  } catch (e) {
    console.warn('[fastsl] add member failed', e)
  }
}
</script>

<style lang="scss" scoped>
.group-panel {
  @apply flex flex-col gap-2 px-4 py-4 border-b;
}
.add-group-btn {
  @apply w-6 h-6 rounded text-primary-default leading-none;
  &:hover {
    @apply text-primary-highest bg-highest;
  }
}
.group-input {
  @apply min-w-0 bg-transparent border-b border-primary-default outline-none text-sm py-1;
}
.group-row {
  @apply flex items-center gap-1 h-8 text-sm;
  .expand-btn {
    @apply w-4 flex-shrink-0 text-dimmer;
  }
  .group-link {
    @apply hover:text-primary-default;
  }
  .group-actions {
    @apply hidden gap-1 text-primary-default;
    button {
      @apply w-6 h-6 rounded leading-none;
      &:hover {
        @apply text-primary-highest bg-highest;
      }
    }
  }
  &:hover .group-actions {
    @apply flex;
  }
}
.members {
  @apply flex flex-col gap-1 pl-5 pb-2 text-sm text-dimmer;
  .member-row {
    @apply flex items-center gap-1 h-6;
    .member-remove {
      @apply hidden w-5 h-5 rounded text-primary-default leading-none;
      &:hover {
        @apply text-primary-highest bg-highest;
      }
    }
    &:hover .member-remove {
      @apply block;
    }
  }
  .add-member-btn {
    @apply self-start text-primary-default text-xs mt-1;
    &:hover {
      @apply text-primary-highest;
    }
  }
}
.add-list {
  @apply flex flex-col gap-1 max-h-72 overflow-auto;
  .add-item {
    @apply flex items-center gap-2 h-8 px-2 rounded hover:bg-higher;
    .add-item-btn {
      @apply ml-auto text-primary-default text-sm px-2;
      &:hover {
        @apply text-primary-highest;
      }
    }
  }
}
</style>
