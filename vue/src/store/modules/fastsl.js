import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fastsl } from '@swanlab-vue/api/fastsl'

/**
 * fastsl 前端状态：实验别名 + 对比分组。
 * 别名按 run_id 存储；分组成员也是 run_id。加载失败时静默降级，不影响仪表盘。
 */
export const useFastslStore = defineStore('fastsl', () => {
  /** state */
  const aliases = ref({}) // { run_id: alias }
  const groups = ref([]) // [{ id, name, members: [run_id] }]
  let mutationRevision = 0

  /** 启动时拉取别名与分组；加载期间若发生写操作，丢弃可能过时的快照。 */
  const load = async () => {
    const revisionAtStart = mutationRevision
    try {
      const { data } = await fastsl.getUI()
      if (revisionAtStart !== mutationRevision) return
      aliases.value = data.aliases || {}
      groups.value = data.groups || []
    } catch (e) {
      // 别名/分组是增强功能，拉取失败不应阻断仪表盘
      console.warn('[fastsl] failed to load ui state', e)
    }
  }

  /** 传入实验对象（含 run_id + name）返回别名或原始名称 */
  const displayName = (exp) => {
    if (!exp) return ''
    const a = aliases.value[exp.run_id]
    return a && a.length ? a : exp.name
  }

  /** 直接按 run_id 获取别名，避免重名实验映射到错误记录。 */
  const displayNameByRunId = (runId, fallback) => {
    const a = aliases.value[runId]
    return a && a.length ? a : fallback
  }

  /** 设置/清除别名（空串清除，恢复原始名称） */
  const setAlias = async (runId, alias) => {
    const trimmed = (alias || '').trim()
    await fastsl.setAlias(runId, trimmed)
    mutationRevision++
    if (trimmed) {
      aliases.value = { ...aliases.value, [runId]: trimmed }
    } else {
      const next = { ...aliases.value }
      delete next[runId]
      aliases.value = next
    }
  }

  /** group actions —— 本地状态在后端确认后再更新 */
  const createGroup = async (name, members = []) => {
    const { data } = await fastsl.createGroup(name, members)
    mutationRevision++
    groups.value = [...groups.value, data.group]
    return data.group
  }
  const renameGroup = async (gid, name) => {
    await fastsl.renameGroup(gid, name)
    mutationRevision++
    groups.value = groups.value.map((g) => (g.id === gid ? { ...g, name } : g))
  }
  const deleteGroup = async (gid) => {
    await fastsl.deleteGroup(gid)
    mutationRevision++
    groups.value = groups.value.filter((g) => g.id !== gid)
  }
  const addMember = async (gid, runId) => {
    await fastsl.addMember(gid, runId)
    mutationRevision++
    groups.value = groups.value.map((g) =>
      g.id === gid && !g.members.includes(runId) ? { ...g, members: [...g.members, runId] } : g
    )
  }
  const removeMember = async (gid, runId) => {
    await fastsl.removeMember(gid, runId)
    mutationRevision++
    groups.value = groups.value.map((g) => (g.id === gid ? { ...g, members: g.members.filter((m) => m !== runId) } : g))
  }

  return {
    aliases,
    groups,
    load,
    displayName,
    displayNameByRunId,
    setAlias,
    createGroup,
    renameGroup,
    deleteGroup,
    addMember,
    removeMember
  }
})
