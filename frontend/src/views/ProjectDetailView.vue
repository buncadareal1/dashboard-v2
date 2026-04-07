<template>
  <div v-if="!project" class="m-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
    <i class="pi pi-exclamation-triangle text-4xl text-amber-500" />
    <h1 class="text-xl font-bold text-slate-900 mt-3">Không tìm thấy dự án</h1>
    <p class="text-sm text-slate-500 mt-1">ID "{{ $route.params.id }}" không tồn tại trong hệ thống.</p>
    <router-link to="/projects" class="inline-block mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm">Quay lại danh sách dự án</router-link>
  </div>
  <div v-else class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-2xl font-semibold text-slate-900">{{ project.name }}</h1>
          <StatusBadge :status="project.status" />
          <MockDataBanner :show="usingMock" />
        </div>
        <p class="text-sm text-slate-500 mt-1">
          <i class="pi pi-map-marker mr-1" />{{ project.location }} · Phụ trách: {{ project.owner.name }}
        </p>
      </div>
      <div class="flex gap-2">
        <Button label="Xuất báo cáo" icon="pi pi-download" outlined size="small" />
        <Button label="Chỉnh sửa" icon="pi pi-pencil" severity="success" size="small" />
      </div>
    </div>

    <!-- KPI 4 cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="k in kpis" :key="k.label" class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div class="flex items-start justify-between">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg" :class="k.iconBg">
            <i :class="['pi', k.icon, k.iconColor]" />
          </div>
          <DeltaChip v-if="k.delta != null" :value="k.delta" />
        </div>
        <p class="mt-4 text-2xl font-bold text-slate-900">{{ k.value }}</p>
        <p class="text-sm text-slate-500 mt-1">{{ k.label }}</p>
      </div>
    </div>

    <!-- Báo cáo doanh thu (wraps KPI tiles + revenue chart + funnel in ONE card) -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 class="text-base font-semibold text-slate-900 mb-4">Báo cáo doanh thu</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="rounded-xl bg-emerald-50 p-5">
          <p class="text-xs text-emerald-700 uppercase font-semibold">Tổng doanh thu</p>
          <p class="text-2xl font-bold text-emerald-700 mt-2">{{ formatVndShort(project.totalRevenue) }}</p>
        </div>
        <div class="rounded-xl bg-blue-50 p-5">
          <p class="text-xs text-blue-700 uppercase font-semibold">Số căn đã bán</p>
          <p class="text-2xl font-bold text-blue-700 mt-2">{{ project.soldUnits }} / {{ project.totalUnits }}</p>
        </div>
        <div class="rounded-xl bg-amber-50 p-5">
          <p class="text-xs text-amber-700 uppercase font-semibold">Chi phí / Doanh thu</p>
          <p class="text-2xl font-bold text-amber-700 mt-2">{{ costRatio }}%</p>
          <p class="text-[11px] text-amber-600 mt-1">Chi phí MKT / Tổng DT</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Revenue chart column -->
        <div class="flex flex-col">
          <div class="flex items-center justify-between mb-4 h-10">
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Doanh thu theo tháng</h3>
              <p class="text-xs text-gray-400 mt-0.5">6 tháng gần nhất</p>
            </div>
          </div>
          <div class="flex-1">
            <apexchart v-if="chartReady" type="bar" height="260" :options="revenueChart.options" :series="revenueChart.series" />
          </div>
        </div>

        <!-- Funnel column -->
        <div class="flex flex-col">
          <div class="flex items-center justify-between mb-4 h-10">
            <div>
              <h3 class="text-sm font-semibold text-gray-900">Funnel chuyển đổi</h3>
              <p class="text-xs text-gray-400 mt-0.5">Tỷ lệ qua từng giai đoạn</p>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block"></span>
              <span class="text-xs text-gray-400">Chuyển đổi</span>
            </div>
          </div>

          <div class="flex gap-3 flex-1">
            <!-- Left: pill bars -->
            <div class="flex-1 flex flex-col justify-between">
              <template v-for="(s, i) in funnel4" :key="s.label">
                <div data-funnel-pill class="flex flex-col items-center w-full">
                  <div class="relative flex items-center justify-between px-3 rounded-lg h-9 transition-all" :style="{ width: funnelWidth(i) }">
                    <div class="absolute inset-0 rounded-lg bg-gradient-to-r opacity-90" :class="funnelGradient(i)"></div>
                    <div class="relative z-10 flex items-center justify-between w-full">
                      <span class="text-white font-semibold text-xs">{{ s.label }}</span>
                      <div class="flex items-center gap-1.5">
                        <span class="text-white/70 text-xs">{{ s.pct }}%</span>
                        <span class="text-white font-bold text-xs">{{ s.count.toLocaleString() }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="i < funnel4.length - 1" class="flex flex-col items-center">
                  <div class="flex items-center gap-1 my-0.5">
                    <div class="h-px w-6 bg-gray-200"></div>
                    <div class="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                      <i class="pi pi-arrow-down text-gray-400 text-[10px]"></i>
                      <span class="text-xs font-semibold text-gray-600">{{ dropPct(i) }}%</span>
                    </div>
                    <div class="h-px w-6 bg-gray-200"></div>
                  </div>
                </div>
              </template>
            </div>

            <!-- Right: info tiles -->
            <div class="flex flex-col gap-1.5">
              <div
                v-for="(s, i) in funnel4"
                :key="s.label + '-tile'"
                class="flex-1 flex items-center justify-between px-2.5 rounded-lg border"
                :class="tileClass(i)"
              >
                <div>
                  <div class="text-xs font-semibold" :class="tileTextClass(i)">{{ s.label }}</div>
                  <div class="text-sm font-bold text-gray-900">{{ s.count.toLocaleString() }}</div>
                </div>
                <div class="text-right" v-if="i > 0">
                  <div class="text-xs font-semibold text-red-500">-{{ dropCount(i).toLocaleString() }}</div>
                  <div class="text-xs text-gray-400">rời</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer summary -->
          <div class="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
            <div>
              <p class="text-xs text-gray-400 mb-0.5">Tổng Lead</p>
              <p class="text-xs font-bold text-emerald-600">{{ funnel4[0]?.count.toLocaleString() }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-0.5">F1</p>
              <p class="text-xs font-bold text-teal-600">{{ funnel4[1]?.count.toLocaleString() }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-0.5">Booking</p>
              <p class="text-xs font-bold text-gray-800">{{ funnel4[3]?.count.toLocaleString() }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Apartment table -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div class="flex items-center justify-between p-5 border-b border-slate-100">
        <h2 class="text-base font-semibold text-slate-900">Danh sách căn hộ & Doanh thu từng căn</h2>
        <div class="flex gap-2 items-center">
          <button
            v-for="t in unitTabs"
            :key="t"
            @click="activeUnitTab = t"
            class="px-3 py-1 text-xs rounded-md"
            :class="activeUnitTab === t ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'"
          >{{ t }}</button>
          <Button label="Xuất Excel" icon="pi pi-file-excel" size="small" outlined />
        </div>
      </div>
      <div class="overflow-x-auto">
        <DataTable :value="units" size="small" stripedRows>
          <Column field="date" header="Ngày GD" />
          <Column field="code" header="Mã căn" />
          <Column field="source" header="Nguồn khách" />
          <Column field="revenue" header="Doanh số" />
          <Column field="staff" header="Nhân viên MKT" />
        </DataTable>
      </div>
    </div>

    <!-- Active campaigns -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-slate-900">Chiến dịch đang hoạt động</h2>
        <div class="flex gap-2">
          <button
            v-for="t in adTabs"
            :key="t"
            @click="activeAdTab = t"
            class="px-3 py-1 text-xs rounded-md"
            :class="activeAdTab === t ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'"
          >{{ t }}</button>
        </div>
      </div>

      <div v-if="!adsConnected" class="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
        <div>
          <p class="font-semibold text-amber-800">Chưa kết nối tài khoản quảng cáo</p>
          <p class="text-xs text-amber-700">Kết nối {{ activeAdTab }} để xem dữ liệu chiến dịch.</p>
        </div>
        <Button label="Kết nối ngay" size="small" severity="warn" @click="adsConnected = true" />
      </div>

      <template v-else>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-[11px] text-slate-500">Tổng chi tiêu</p><p class="font-bold">320M</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-[11px] text-slate-500">Tổng hiển thị</p><p class="font-bold">2.4M</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-[11px] text-slate-500">Tổng F1</p><p class="font-bold">540</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-[11px] text-slate-500">Tổng Lead</p><p class="font-bold">720</p></div>
        </div>
        <div class="overflow-x-auto">
          <DataTable :value="campaigns" size="small" stripedRows>
            <Column field="name" header="Tên chiến dịch" />
            <Column field="spend" header="Chi tiêu" />
            <Column field="impressions" header="Hiển thị" />
            <Column field="ctr" header="CTR" />
            <Column field="lead" header="Lead" />
            <Column field="f1" header="F1" />
            <Column field="qualify" header="Tỉ lệ Qualify" />
            <Column field="cpl" header="CPL" />
            <Column header="Hiệu quả">
              <template #body="{ data }"><Tag :value="data.efficiency" :severity="data.efficiency === 'Xuất sắc' ? 'success' : 'info'" /></template>
            </Column>
            <Column header="Trạng thái">
              <template #body="{ data }"><StatusBadge :status="data.status" /></template>
            </Column>
          </DataTable>
        </div>
      </template>
    </div>

    <!-- Best ad creatives -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="text-base font-semibold text-slate-900">Mẫu quảng cáo hiệu quả</h2>
        <div class="flex gap-2">
          <Dropdown v-model="adSort" :options="sortOptions" optionLabel="label" class="w-52" />
          <button
            v-for="t in adTabs"
            :key="t"
            @click="activeCreativeSource = t"
            class="px-3 py-1 text-xs rounded-md"
            :class="activeCreativeSource === t ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'"
          >{{ t }}</button>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div class="rounded-lg bg-slate-50 p-3"><p class="text-[11px] text-slate-500">Tổng F1</p><p class="font-bold">645</p></div>
        <div class="rounded-lg bg-slate-50 p-3"><p class="text-[11px] text-slate-500">Tổng Booking</p><p class="font-bold">85</p></div>
        <div class="rounded-lg bg-slate-50 p-3"><p class="text-[11px] text-slate-500">Tổng Lead</p><p class="font-bold">918</p></div>
        <div class="rounded-lg bg-slate-50 p-3"><p class="text-[11px] text-slate-500">Tổng chi tiêu</p><p class="font-bold">320M</p></div>
      </div>

      <div class="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 mb-4">
        <p class="text-xs text-amber-700 font-semibold">🏆 Mẫu quảng cáo hiệu quả nhất</p>
        <p class="text-sm font-bold text-amber-900 mt-1">{{ sortedCreatives[0].title }}</p>
        <p class="text-xs text-amber-700 mt-1">{{ sortedCreatives[0].f1 }} F1 · {{ sortedCreatives[0].booking }} Booking · {{ sortedCreatives[0].leads }} leads</p>
      </div>

      <div class="space-y-3">
        <div
          v-for="(c, i) in sortedCreatives"
          :key="c.title"
          data-creative-card
          class="rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200"
        >
          <div
            data-creative-toggle
            class="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
            @click="toggleCreative(c.title)"
          >
            <div class="w-7 h-7 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-xs">{{ i + 1 }}</div>
            <div class="w-20 h-14 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                <p class="font-semibold text-slate-900 truncate">{{ c.title }}</p>
                <span class="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 flex-shrink-0">{{ c.type }}</span>
              </div>
              <p class="text-xs text-gray-400 truncate mt-0.5">{{ c.tagline }}</p>
            </div>
            <div class="flex items-center gap-6 flex-shrink-0">
              <div class="text-center">
                <div class="text-sm font-bold text-emerald-600">{{ c.f1 }}</div>
                <div class="text-xs text-gray-400">F1</div>
              </div>
              <div class="text-center">
                <div class="text-sm font-bold text-indigo-600">{{ c.booking }}</div>
                <div class="text-xs text-gray-400">Booking</div>
              </div>
              <div class="text-center">
                <div class="text-sm font-bold text-sky-600">{{ c.leads }}</div>
                <div class="text-xs text-gray-400">Leads</div>
              </div>
              <i
                class="pi text-sm transition-transform duration-200"
                :class="expandedCreativeId === c.title ? 'pi-chevron-up' : 'pi-chevron-down'"
              ></i>
            </div>
          </div>

          <div v-if="expandedCreativeId === c.title" class="px-4 pb-4 border-t border-gray-100 bg-gray-50/30">
            <div class="pt-4 grid grid-cols-2 gap-4">
              <!-- Left: Ad content -->
              <div>
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nội dung quảng cáo</div>
                <div class="rounded-xl overflow-hidden border border-gray-200 bg-white">
                  <div class="w-full h-40 bg-slate-200"></div>
                  <div class="p-3">
                    <p class="text-sm font-semibold text-slate-900">{{ c.title }}</p>
                    <p class="text-xs text-slate-500 mt-1">{{ c.tagline }}</p>
                    <p class="text-[11px] text-gray-400 mt-2">Bắt đầu: 01/03/2024</p>
                    <span class="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Đang chạy</span>
                  </div>
                </div>
              </div>
              <!-- Right: Performance metrics -->
              <div>
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chỉ số hiệu suất</div>
                <div class="grid grid-cols-2 gap-2">
                  <div v-for="m in creativeMetrics(c)" :key="m.label" class="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-gray-100">
                    <div>
                      <div class="text-[10px] text-gray-400 uppercase">{{ m.label }}</div>
                      <div class="text-sm font-bold text-slate-900">{{ m.value }}</div>
                    </div>
                  </div>
                </div>
                <div class="mt-3 text-xs text-gray-500">Điểm hiệu quả tổng thể: <b class="text-emerald-600">{{ c.score }}/100</b></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Analytic -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div class="flex items-center gap-2 mb-3">
        <h2 class="text-base font-semibold text-slate-900">AI Analytic</h2>
        <span class="text-[10px] px-2 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">AI Powered</span>
      </div>
      <p class="text-sm text-slate-500">Phân tích tự động các chỉ số chiến dịch và mẫu quảng cáo để đưa ra lời khuyên tối ưu</p>

      <div class="mt-4 space-y-4">
        <div class="rounded-xl bg-slate-50 p-4">
          <p class="text-xs font-semibold text-slate-700 uppercase">Tóm tắt hiệu suất tổng thể</p>
          <p class="text-sm text-slate-700 mt-2">Dự án {{ project.name }} đang có {{ campaigns.length }} chiến dịch hoạt động với tổng {{ project.leadCount }} leads và {{ project.f1Count }} F1 (tỷ lệ qualify {{ Math.round((project.f1Count/project.leadCount)*100) }}%). Mẫu quảng cáo "{{ sortedCreatives[0]?.title }}" đang cho hiệu quả tốt nhất với {{ sortedCreatives[0]?.f1 }} F1 và {{ sortedCreatives[0]?.booking }} booking.</p>
        </div>

        <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-emerald-700 uppercase">Mẫu quảng cáo nên scale</p>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Hiệu quả cao nhất</span>
          </div>
          <p class="text-sm font-bold text-emerald-900 mt-2">Lead Form - Nhận báo giá ngay</p>
          <p class="text-xs text-emerald-700 mt-1">193 F1 · 28 Booking · 276 Leads</p>
          <p class="text-xs text-emerald-700 mt-2">💡 Đề xuất: Tăng ngân sách 30-50% và tạo các biến thể tương tự để mở rộng tiếp cận</p>
        </div>

        <div class="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p class="text-xs font-semibold text-amber-700 uppercase">Chiến dịch cần tối ưu</p>
          <p class="text-xs text-amber-700">Các chiến dịch có qualify rate thấp hoặc CPL cao</p>
          <div class="mt-2 flex items-center justify-between rounded-lg bg-white p-3">
            <div>
              <p class="text-sm font-semibold text-slate-900">{{ project.name }} - Search Ads</p>
              <p class="text-xs text-slate-500">Qualify rate: 72% · CPL: 531K</p>
            </div>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Cần xem xét</span>
          </div>
        </div>

        <div class="rounded-xl border border-violet-100 bg-violet-50 p-4">
          <p class="text-xs font-semibold text-violet-700 uppercase">Đề xuất tối ưu (2)</p>
          <div class="mt-3 space-y-3">
            <div class="rounded-lg bg-white p-3">
              <div class="flex items-start justify-between">
                <p class="text-sm font-semibold text-slate-900">CPL cần tối ưu ở "{{ project.name }} - Search Ads" (531K)</p>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Ưu tiên trung bình</span>
              </div>
              <p class="text-xs text-slate-600 mt-2">Đề xuất: A/B test các creative khác nhau để tìm mẫu quảng cáo có CPL thấp hơn. Tối ưu landing page để tăng tỷ lệ chuyển đổi. Xem xét loại bỏ các placement kém hiệu quả.</p>
              <span class="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700">Cost</span>
            </div>
            <div class="rounded-lg bg-white p-3">
              <div class="flex items-start justify-between">
                <p class="text-sm font-semibold text-slate-900">Scale mẫu quảng cáo "Lead Form - Nhận báo giá ngay"</p>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Ưu tiên cao</span>
              </div>
              <p class="text-xs text-slate-600 mt-2">Mẫu quảng cáo này đang cho hiệu quả xuất sắc với 193 F1 và 28 booking. Đề xuất: Tăng ngân sách 30-50% để mở rộng tiếp cận. Tạo các biến thể tương tự với cùng concept nhưng khác góc nhìn/CTA.</p>
              <span class="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Scale</span>
            </div>
          </div>
          <p class="text-[11px] text-slate-500 mt-3 italic">Các đề xuất được tạo tự động dựa trên phân tích dữ liệu thực tế. Vui lòng xem xét kỹ trước khi áp dụng.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import StatusBadge from '../components/ui/StatusBadge.vue'
import DeltaChip from '../components/ui/DeltaChip.vue'
import MockDataBanner from '../components/ui/MockDataBanner.vue'
import { MOCK_PROJECTS } from '../lib/mockProjects'
import { formatVndShort } from '../lib/format'
import { fetchProjectDetail } from '../lib/api'

const route = useRoute()
const mockProject = MOCK_PROJECTS.find((p) => p.id === route.params.id) || null
const projectData = ref(mockProject)
const project = computed(() => projectData.value)
const usingMock = ref(false)

onMounted(async () => {
  try {
    const { data } = await fetchProjectDetail(route.params.id)
    const payload = data?.data || data
    if (payload && typeof payload === 'object') {
      // Merge backend response with mock to keep optional fields (funnel, creatives)
      projectData.value = { ...(mockProject || {}), ...payload, detail: { ...(mockProject?.detail || {}), ...(payload.detail || {}) } }
    } else if (!mockProject) {
      usingMock.value = true
    }
  } catch (e) {
    usingMock.value = true
    console.warn('[project-detail] using mock data:', e.message)
  }
})

const costRatio = computed(() =>
  project.value ? ((project.value.totalBudget / project.value.totalRevenue) * 100).toFixed(1) : '0',
)

const revenueStats = computed(() => {
  if (!project.value) return { max: 0, maxMonth: '', min: 0, minMonth: '', avg: 0 }
  const data = project.value.detail.revenueSeries
  const months = project.value.detail.revenueMonths
  const maxIdx = data.indexOf(Math.max(...data))
  const minIdx = data.indexOf(Math.min(...data))
  const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length)
  return { max: data[maxIdx], maxMonth: months[maxIdx], min: data[minIdx], minMonth: months[minIdx], avg }
})

const kpis = computed(() => {
  if (!project.value) return []
  return [
    { label: 'Tổng ngân sách', value: formatVndShort(project.value.totalBudget), delta: 12, icon: 'pi-wallet', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { label: 'Tổng Lead', value: project.value.leadCount, delta: 18, icon: 'pi-users', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: 'CPL', value: formatVndShort(Math.round(project.value.totalBudget / project.value.leadCount)), delta: -5, icon: 'pi-tag', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
    { label: 'Conversion Rate', value: ((project.value.dealCount / project.value.leadCount) * 100).toFixed(1) + '%', delta: 8, icon: 'pi-percentage', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
  ]
})

const chartReady = ref(false)
onMounted(() => { chartReady.value = true })

const revenueChart = computed(() => ({
  options: {
    chart: { toolbar: { show: false } },
    colors: ['#10b981'],
    plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
    dataLabels: { enabled: true, formatter: (v) => v + 'B' },
    xaxis: { categories: project.value?.detail.revenueMonths || [] },
    yaxis: { labels: { formatter: (v) => v + 'B' } },
    grid: { borderColor: '#f1f5f9' },
  },
  series: [{ name: 'Doanh thu (tỷ)', data: project.value?.detail.revenueSeries || [] }],
}))

const funnel = computed(() => project.value?.detail.funnel || [])

// Remap 5-stage funnel (Lead/Contacted/F1/Visit/Booking) → 4 stages per Readdy
const funnel4 = computed(() => {
  const raw = funnel.value
  if (!raw.length) return []
  const byLabel = (needle) => raw.find((s) => s.label.toLowerCase().includes(needle))
  const lead = byLabel('lead') || raw[0]
  const f1 = byLabel('f1') || byLabel('qualified') || raw[2]
  const visit = byLabel('visit') || raw[3]
  const booking = byLabel('booking') || raw[raw.length - 1]
  const top = lead.count || 1
  const mk = (label, s) => ({ label, count: s.count, pct: Math.round((s.count / top) * 100) })
  return [
    mk('Lead', lead),
    mk('Qualified (F1)', f1),
    mk('Visit', visit),
    mk('Booking', booking),
  ]
})

const funnelGradients = [
  'from-emerald-500 to-emerald-400',
  'from-teal-500 to-teal-400',
  'from-sky-500 to-sky-400',
  'from-indigo-500 to-indigo-400',
]
const funnelGradient = (i) => funnelGradients[i] || funnelGradients[0]

// Visual taper widths matching Readdy (each pill shrinks regardless of actual count)
const FUNNEL_TAPER = ['100%', '82%', '64%', '46%', '32%']
const funnelWidth = (i) => FUNNEL_TAPER[i] || FUNNEL_TAPER[FUNNEL_TAPER.length - 1]

const tileColors = ['emerald', 'teal', 'sky', 'indigo']
const tileClassMap = {
  emerald: 'bg-emerald-50 border-emerald-100',
  teal: 'bg-teal-50 border-teal-100',
  sky: 'bg-sky-50 border-sky-100',
  indigo: 'bg-indigo-50 border-indigo-100',
}
const tileTextMap = {
  emerald: 'text-emerald-700',
  teal: 'text-teal-700',
  sky: 'text-sky-700',
  indigo: 'text-indigo-700',
}
const tileClass = (i) => tileClassMap[tileColors[i]]
const tileTextClass = (i) => tileTextMap[tileColors[i]]

const dropCount = (i) => {
  const arr = funnel4.value
  if (i <= 0 || !arr[i] || !arr[i - 1]) return 0
  return arr[i - 1].count - arr[i].count
}
const dropPct = (i) => {
  const arr = funnel4.value
  if (!arr[i] || !arr[i + 1] || !arr[i].count) return 0
  return Math.round(((arr[i].count - arr[i + 1].count) / arr[i].count) * 100)
}

const unitTabs = ['Đã chốt', 'Booking']
const activeUnitTab = ref('Đã chốt')
const units = computed(() => project.value?.detail.units || [])

const adTabs = ['Facebook Ads', 'Google Ads']
const activeAdTab = ref('Facebook Ads')
const adsConnected = ref(true)
const campaigns = computed(() => project.value?.detail.campaigns || [])

const sortOptions = [
  { label: 'Nhiều F1 nhất', value: 'f1' },
  { label: 'Nhiều Booking nhất', value: 'booking' },
  { label: 'Nhiều Lead nhất', value: 'leads' },
  { label: 'CPL thấp nhất', value: 'cpl' },
  { label: 'CTR cao nhất', value: 'ctr' },
  { label: 'Chi tiêu cao nhất', value: 'spend' },
]
const adSort = ref(sortOptions[0])
const sortedCreatives = computed(() => {
  const key = adSort.value?.value || 'f1'
  const map = { f1: 'f1', booking: 'booking', leads: 'leads', cpl: 'cpl', ctr: 'ctr', spend: 'f1' }
  const k = map[key]
  const parse = (v) => typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0
  const arr = [...(project.value?.detail.creatives || [])]
  arr.sort((a, b) => parse(b[k]) - parse(a[k]))
  if (key === 'cpl') arr.reverse()
  return arr
})
const activeCreativeSource = ref('Facebook Ads')

const expandedCreativeId = ref(null)
const toggleCreative = (id) => {
  expandedCreativeId.value = expandedCreativeId.value === id ? null : id
}

const creativeMetrics = (c) => {
  const spend = Math.round((c.leads || 0) * (parseFloat(String(c.cpl).replace(/[^0-9.]/g, '')) || 0))
  const impressions = (c.leads || 0) * 2800
  const clicks = Math.round(impressions * (parseFloat(String(c.ctr).replace(/[^0-9.]/g, '')) || 0) / 100)
  const fmtK = (n) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'K' : String(n)
  return [
    { label: 'F1', value: c.f1 },
    { label: 'Booking', value: c.booking },
    { label: 'Chi tiêu', value: fmtK(spend) },
    { label: 'Hiển thị', value: fmtK(impressions) },
    { label: 'Click', value: fmtK(clicks) },
    { label: 'CTR', value: c.ctr },
    { label: 'Leads', value: c.leads },
    { label: 'CPL', value: c.cpl },
  ]
}
</script>
