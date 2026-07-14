<template>
  <div class="flex flex-col min-h-full bg-higher">
    <ChartsPage
      :groups="groups"
      :charts="charts"
      :default-color="defaultColor"
      :get-color="getColor"
      :key="chartsPageKey"
      v-if="groups.length"
    />
    <!-- 分组为空或图表不存在 -->
    <p class="font-semibold pt-5 text-center" v-else-if="ready">Empty Charts</p>
  </div>
</template>

<script setup>
/**
 * @description: fastsl 分组对比视图。复用项目对比的 ChartsPage 组件，仅把数据源换成
 * /fastsl/group/{gid}/charts（仅叠加组内实验的曲线/图像/音频）。切换分组时按 gid 重新拉取。
 * @file: GroupChartsView.vue
 **/
import { fastsl } from '@swanlab-vue/api/fastsl'
import { useProjectStore, useFastslStore } from '@swanlab-vue/store'
import { ref, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import ChartsPage from '../charts/components/ChartsPage.vue'

const projectStore = useProjectStore()
const fastslStore = useFastslStore()
const route = useRoute()

const ready = ref(false)
const groups = ref([])
const charts = ref([])
const namespaces = ref([])
const chartsPageKey = ref(0)
let requestGeneration = 0

const loadGroup = async (gid) => {
  const generation = ++requestGeneration
  ready.value = false
  groups.value = []
  try {
    const { data } = await fastsl.getGroupCharts(gid)
    if (generation !== requestGeneration) return
    charts.value = data.charts
    namespaces.value = data.namespaces
    groups.value = generateGroups()
    chartsPageKey.value++
  } catch (e) {
    if (generation !== requestGeneration) return
    console.warn('[fastsl] load group charts failed', e)
    charts.value = []
    namespaces.value = []
    groups.value = []
  } finally {
    if (generation === requestGeneration) ready.value = true
  }
}

// 与 ChartsView 相同的可见性过滤：source 名称仍来自 projectStore（按实验名映射）
const generateGroups = () => {
  const result = []
  namespaces.value.forEach((namespace) => {
    const group = { ...namespace, charts: [] }
    namespace.charts.forEach((chart_id) => {
      const chart = charts.value.find((chart) => chart.id === chart_id)
      if (!chart) return
      if (chart.source.every((source) => !projectStore.showMap[source])) return
      const sources = chart.source.filter((source) => !chart.error[source])
      if (sources.every((source) => !projectStore.showMap[source])) return
      group.charts.push(chart)
    })
    if (group.charts.length) result.push(group)
  })
  return result
}

// 点击眼睛(show)后重渲染
const handleShowChange = () => {
  chartsPageKey.value++
  groups.value = generateGroups()
}
projectStore.registerChangeShowCallback(handleShowChange)
onUnmounted(() => {
  requestGeneration++
  projectStore.destoryChangeShowCallback()
})

// ---------------------------------- 色盘注入（沿用项目色盘，按实验名） ----------------------------------
const getColor = (() => {
  const colors = projectStore.colorMap
  return (exp_name) => colors[exp_name]
})()
const defaultColor = projectStore.colors[0]

// 切换分组、或当前分组成员发生变化（加入/移除实验）时重新拉取，实现对比图实时刷新。
// 把 gid 与当前分组成员签名合并成一个键，任一变化都只触发一次重载。
watch(
  () => {
    const gid = route.params.gid
    const g = fastslStore.groups.find((x) => String(x.id) === String(gid))
    return `${gid}|${g ? [...g.members].sort().join(',') : ''}`
  },
  () => {
    const gid = route.params.gid
    if (gid !== undefined) loadGroup(gid)
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped></style>
