<template>
  <RouterLink class="flex gap-2 items-center w-full" :to="`/experiment/${id}`">
    <circle class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: $props.color }" />
    <p class="truncate" :title="name">{{ displayName }}</p>
  </RouterLink>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { computed } from 'vue'
import { useFastslStore } from '@swanlab-vue/store'

/**
 * @description: 展示实验名称和实验对应的颜色，并且可以完成实验跳转
 * @file: ExperimentName.vue
 * @since: 2023-12-08 20:16:08
 **/

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  id: {
    required: true
  },
  runId: {
    type: String,
    required: true
  }
})

// 有别名则显示别名，否则显示原始名称（title 仍保留原始名称便于对照）
const fastslStore = useFastslStore()
const displayName = computed(() => fastslStore.displayNameByRunId(props.runId, props.name))
</script>

<style lang="scss" scoped></style>
