<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-2xl font-semibold text-gray-900">Quản lý dự án</h1>
          <MockDataBanner :show="usingMock" />
        </div>
        <p class="text-sm text-gray-500 mt-1">Theo dõi và quản lý tất cả dự án bất động sản</p>
      </div>
      <Button label="Thêm dự án mới" icon="pi pi-plus" severity="success" @click="showCreate = true" />
    </div>

    <!-- Filter card -->
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-center gap-2 flex-wrap">
        <button
          v-for="t in tabs"
          :key="t.key"
          @click="activeTab = t.key"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          :class="
            activeTab === t.key
              ? 'bg-emerald-50 text-emerald-600'
              : 'text-gray-600 hover:bg-gray-50'
          "
        >
          {{ t.label }}{{ t.key === 'all' ? ` (${countFor(t.key)})` : '' }}
        </button>
      </div>
    </div>

    <!-- Project cards grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <router-link
        v-for="p in filteredProjects"
        :key="p.id"
        :to="`/projects/${p.id}`"
        class="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow block"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <h3 class="text-base font-semibold text-gray-900 mb-1">{{ p.name }}</h3>
            <p class="text-sm text-gray-500"><i class="pi pi-map-marker mr-1 text-xs" />{{ p.location }}</p>
          </div>
          <StatusBadge :status="p.status" />
        </div>

        <div class="grid grid-cols-3 gap-4 mb-4">
          <div v-for="s in stats(p)" :key="s.label">
            <p class="text-xs text-gray-500 mb-1">{{ s.label }}</p>
            <p class="text-sm font-semibold text-gray-900">{{ s.value }}</p>
          </div>
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-gray-100">
          <div class="flex items-center gap-2">
            <Avatar :label="p.owner.initial" shape="circle" size="normal" class="bg-emerald-100 text-emerald-700" />
            <span class="text-xs text-gray-600">{{ p.owner.name }}</span>
          </div>
          <div class="flex gap-1">
            <ChannelChip v-for="c in p.channels" :key="c" :channel="c" />
          </div>
        </div>
      </router-link>
    </div>

    <Dialog v-model:visible="showCreate" header="Thêm dự án mới" modal :style="{ width: '480px' }">
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Tên dự án</label>
          <InputText v-model="newProject.name" class="w-full mt-1" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Vị trí</label>
          <InputText v-model="newProject.location" class="w-full mt-1" />
        </div>
      </div>
      <template #footer>
        <Button label="Hủy" text @click="showCreate = false" />
        <Button label="Tạo" severity="success" @click="showCreate = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Avatar from 'primevue/avatar'
import StatusBadge from '../components/ui/StatusBadge.vue'
import ChannelChip from '../components/ui/ChannelChip.vue'
import MockDataBanner from '../components/ui/MockDataBanner.vue'
import { MOCK_PROJECTS } from '../lib/mockProjects'
import { formatVndShort, formatNumber } from '../lib/format'
import { fetchProjects as apiFetchProjects } from '../lib/api'

const projects = ref([...MOCK_PROJECTS])
const usingMock = ref(false)

onMounted(async () => {
  try {
    const { data } = await apiFetchProjects()
    const rows = data?.data || data
    if (Array.isArray(rows) && rows.length) {
      projects.value = rows
    } else {
      usingMock.value = true
    }
  } catch (e) {
    usingMock.value = true
    console.warn('[projects] using mock data:', e.message)
  }
})

const tabs = [
  { key: 'all', label: 'Tất cả' },
  { key: 'running', label: 'Đang chạy' },
  { key: 'warning', label: 'Cảnh báo' },
  { key: 'paused', label: 'Tạm dừng' },
]
const activeTab = ref('all')

function countFor(key) {
  if (key === 'all') return projects.value.length
  return projects.value.filter((p) => p.status === key).length
}

const filteredProjects = computed(() =>
  activeTab.value === 'all' ? projects.value : projects.value.filter((p) => p.status === activeTab.value),
)

function stats(p) {
  const cpl = p.leadCount ? Math.round(p.totalBudget / p.leadCount) : 0
  const conversion = p.leadCount ? ((p.dealCount / p.leadCount) * 100).toFixed(1) : '0'
  return [
    { label: 'Ngân sách', value: formatVndShort(p.totalBudget) },
    { label: 'Tổng Lead', value: formatNumber(p.leadCount) },
    { label: 'CPL', value: formatVndShort(cpl) },
    { label: 'Lead F1', value: formatNumber(p.f1Count) },
    { label: 'Conversion', value: conversion + '%' },
    { label: 'Booking', value: formatNumber(p.bookingCount) },
  ]
}

const showCreate = ref(false)
const newProject = ref({ name: '', location: '' })
</script>
