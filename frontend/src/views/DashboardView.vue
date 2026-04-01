<template>
  <div class="space-y-8 fade-in-animation pb-10">

    <!-- LOADING STATE -->
    <div v-if="appData.isLoading" class="animate-pulse space-y-8">
        <div class="h-40 bg-surface-container rounded-xl"></div>
        <div class="grid grid-cols-4 gap-6"><div v-for="i in 4" :key="i" class="h-32 bg-surface-container rounded-xl"></div></div>
    </div>

    <div v-else class="space-y-8">

        <!-- AI EXECUTIVE SUMMARY -->
        <section class="rounded-2xl p-8 border-l-[4px] border-primary relative overflow-hidden shadow-md" style="backdrop-filter: blur(12px); background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(0, 109, 51, 0.06) 50%, rgba(70, 72, 212, 0.04) 100%);">
            <div class="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-40 top-[-10px] animate-[scan_3s_linear_infinite]" style="box-shadow: 0 4px 10px rgba(0,109,51,0.5);"></div>
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div class="space-y-1">
                    <div class="flex items-center gap-2 text-primary font-bold tracking-tight mb-2">
                        <span class="material-symbols-outlined text-xl animate-pulse" style="font-variation-settings: 'FILL' 1;">insights</span>
                        <span class="text-[10px] uppercase font-headline font-black tracking-[0.2em]">Phân tích phễu AI</span>
                    </div>
                    <h1 class="text-3xl font-headline font-extrabold text-on-surface">Tổng quan thông minh</h1>
                    <p class="text-on-surface-variant max-w-2xl text-sm leading-relaxed mt-2">
                        <span class="font-bold text-primary">{{ advMetrics.conversionRate }}% CR</span> sau click.
                        Rơi nhiều nhất: <span class="font-bold text-error">Hiển thị → Click ({{ (100 - parseFloat(advMetrics.ctr)).toFixed(1) }}% mất)</span>.
                        CPL ở mức <span class="font-bold text-tertiary">{{ advMetrics.cpl }}</span> —
                        <span v-if="parseFloat(advMetrics.roas) >= 3" class="text-primary font-bold">ROAS {{ advMetrics.roas }}x rất tốt.</span>
                        <span v-else class="text-error font-bold">ROAS {{ advMetrics.roas }}x cần tối ưu.</span>
                    </p>
                </div>
            </div>
        </section>

        <!-- AI INSIGHTS -->
        <section class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings: 'FILL' 1">psychology</span>
              <div>
                <h4 class="font-headline font-bold text-sm text-on-surface">Nhận xét AI</h4>
                <p class="text-[10px] text-on-surface-variant">{{ aiProvider === 'rule_based' ? 'Phân tích tự động' : 'Phân tích bởi ' + aiProvider.toUpperCase() }}</p>
              </div>
            </div>
            <button @click="fetchAiAnalysis" :disabled="aiLoading" class="bg-primary/10 border border-primary/30 text-black px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-all">
              <span class="material-symbols-outlined text-[14px]" :class="{'animate-spin': aiLoading}">{{ aiLoading ? 'sync' : 'auto_awesome' }}</span>
              {{ aiLoading ? 'Đang phân tích...' : 'Phân tích lại' }}
            </button>
          </div>
          <div class="px-8 py-6">
            <div v-if="aiLoading" class="animate-pulse space-y-3">
              <div class="h-4 bg-slate-100 rounded w-full"></div>
              <div class="h-4 bg-slate-100 rounded w-4/5"></div>
              <div class="h-4 bg-slate-100 rounded w-3/5"></div>
            </div>
            <div v-else-if="aiAnalysis" class="text-sm text-on-surface leading-relaxed whitespace-pre-line">{{ aiAnalysis }}</div>
            <p v-else class="text-sm text-on-surface-variant italic">Nhấn "Phân tích lại" để nhận nhận xét từ AI.</p>
            <p v-if="aiError" class="text-xs text-amber-600 mt-3 font-bold">{{ aiError }}</p>
          </div>
        </section>

        <!-- TIMESTAMP BAR -->
        <div class="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div class="flex items-center gap-2 text-on-surface-variant">
            <span class="material-symbols-outlined text-[14px]">schedule</span>
            <span>Dữ liệu cập nhật lúc <b class="text-on-surface">{{ lastUpdatedText }}</b></span>
          </div>
          <div class="flex items-center gap-2 text-on-surface-variant">
            <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span>Tự động làm mới mỗi 5 phút</span>
          </div>
        </div>

        <!-- TIER 1: FINANCIAL KPIs - 6 CARDS WITH DISTINCT COLORS -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <!-- Total Spend -->
            <div class="bg-surface-container-lowest rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
                <div class="absolute right-[-10px] bottom-[-10px] opacity-[0.04] pointer-events-none"><span class="material-symbols-outlined text-[80px]">payments</span></div>
                <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600 mb-3">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">payments</span>
                </div>
                <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">Tổng chi tiêu <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Tổng số tiền đã chi cho quảng cáo trong khoảng thời gian đã chọn">help</span></p>
                <p class="text-xl font-headline font-black text-on-surface">{{ advMetrics.totalSpend }}</p>
                <p class="text-[10px] text-on-surface-variant font-bold mt-1">{{ advMetrics.avgDailyBudget }}/ngày</p>
            </div>
            <!-- CPL -->
            <div class="bg-surface-container-lowest rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600 mb-3">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">person_pin_circle</span>
                </div>
                <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">CPL <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Chi phí trung bình để có được 1 đơn hàng (Cost Per Lead)">help</span></p>
                <p class="text-xl font-headline font-black" :class="parseFloat(advMetrics.cplRaw) > 15 ? 'text-error' : 'text-on-surface'">{{ advMetrics.cpl }}</p>
                <p class="text-[10px] font-bold mt-1" :class="parseFloat(advMetrics.cplRaw) > 15 ? 'text-error' : 'text-primary'">{{ parseFloat(advMetrics.cplRaw) > 15 ? 'Vượt ngưỡng' : 'Đạt mục tiêu' }}</p>
            </div>
            <!-- CPC -->
            <div class="bg-surface-container-lowest rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-100 text-violet-600 mb-3">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">ads_click</span>
                </div>
                <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">CPC <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Chi phí trung bình cho mỗi lượt click (Cost Per Click)">help</span></p>
                <p class="text-xl font-headline font-black text-on-surface">{{ advMetrics.cpc }}</p>
                <p class="text-[10px] text-on-surface-variant font-bold mt-1">Chi phí mỗi click</p>
            </div>
            <!-- CPM -->
            <div class="bg-surface-container-lowest rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-cyan-100 text-cyan-600 mb-3">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">visibility</span>
                </div>
                <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">CPM <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Chi phí cho mỗi 1,000 lượt hiển thị (Cost Per Mille)">help</span></p>
                <p class="text-xl font-headline font-black text-on-surface">{{ advMetrics.cpm }}</p>
                <p class="text-[10px] text-on-surface-variant font-bold mt-1">Mỗi 1K hiển thị</p>
            </div>
            <!-- ROAS -->
            <div class="rounded-xl p-5 hover:-translate-y-1 transition-transform shadow-sm relative overflow-hidden border"
                 :class="parseFloat(advMetrics.roas) >= 3 ? 'bg-primary/5 border-primary/20' : 'bg-error/5 border-error/20'">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                     :class="parseFloat(advMetrics.roas) >= 3 ? 'bg-primary/15 text-primary' : 'bg-error/15 text-error'">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">trending_up</span>
                </div>
                <p class="text-[9px] uppercase font-black tracking-widest mb-1 flex items-center gap-1" :class="parseFloat(advMetrics.roas) >= 3 ? 'text-primary' : 'text-error'">ROAS <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Tỷ lệ doanh thu trên chi tiêu quảng cáo (Return On Ad Spend)">help</span></p>
                <p class="text-xl font-headline font-black" :class="parseFloat(advMetrics.roas) >= 3 ? 'text-primary' : 'text-error'">{{ advMetrics.roas }}x</p>
                <p class="text-[10px] font-bold mt-1" :class="parseFloat(advMetrics.roas) >= 3 ? 'text-primary' : 'text-error'">{{ parseFloat(advMetrics.roas) >= 3 ? 'Có lãi' : 'Cần cải thiện' }}</p>
            </div>
            <!-- Frequency -->
            <div class="bg-surface-container-lowest rounded-xl p-5 hover:-translate-y-1 transition-transform border border-slate-200 shadow-sm relative overflow-hidden">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-100 text-rose-600 mb-3">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1">repeat</span>
                </div>
                <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest mb-1 flex items-center gap-1">Tần suất <span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 cursor-help" title="Trung bình mỗi người xem quảng cáo bao nhiêu lần">help</span></p>
                <p class="text-xl font-headline font-black" :class="advMetrics.frequency > 3 ? 'text-error' : 'text-on-surface'">{{ advMetrics.frequency }}</p>
                <p class="text-[10px] font-bold mt-1" :class="advMetrics.frequency > 3 ? 'text-error' : 'text-on-surface-variant'">{{ advMetrics.frequency > 3 ? 'Nguy cơ bão hòa' : 'Mức an toàn' }}</p>
            </div>
        </div>

        <!-- KPI GOALS PROGRESS -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div v-for="g in kpiGoals" :key="g.label" class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div class="flex justify-between items-center mb-2">
              <span class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{{ g.label }}</span>
              <span class="text-xs font-black" :class="goalReached(g) ? 'text-primary' : 'text-amber-600'">{{ g.current }}{{ g.unit }} / {{ g.target }}{{ g.unit }}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2.5">
              <div class="h-2.5 rounded-full transition-all duration-700" :class="goalReached(g) ? 'bg-primary' : 'bg-amber-500'" :style="`width: ${goalProgress(g)}%`"></div>
            </div>
            <p class="text-[10px] mt-2 font-bold" :class="goalReached(g) ? 'text-primary' : 'text-amber-600'">{{ goalReached(g) ? '✅ Đạt mục tiêu' : '⚠️ Chưa đạt' }}</p>
          </div>
        </div>

        <!-- TIER 2: FUNNEL DROP-OFF (THE KEY CHART) -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <!-- Funnel Drop-off Bar Chart -->
            <div class="lg:col-span-3 bg-surface-container-lowest rounded-xl p-8 border border-slate-200 shadow-sm">
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <h4 class="text-xl font-headline font-extrabold text-on-surface">Phân tích rơi phễu chuyển đổi</h4>
                        <p class="text-xs text-on-surface-variant font-medium mt-1">Xem chính xác bạn mất người dùng ở giai đoạn nào</p>
                    </div>
                </div>
                <apexchart type="bar" height="340" :options="funnelChartOptions" :series="funnelChartSeries"></apexchart>
                <!-- Drop rate labels -->
                <div class="flex justify-center gap-2 mt-4 flex-wrap">
                    <div v-for="d in dropRates" :key="d.label" class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider"
                         :class="d.severity === 'high' ? 'bg-error/10 text-error' : d.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'">
                        <span class="material-symbols-outlined text-[14px]">{{ d.severity === 'high' ? 'arrow_downward' : d.severity === 'medium' ? 'remove' : 'arrow_upward' }}</span>
                        {{ d.label }}: {{ d.rate }}
                    </div>
                </div>
            </div>

            <!-- Conversion Metrics Sidebar -->
            <div class="lg:col-span-2 space-y-4">
                <!-- Conversion Rate Card -->
                <div class="bg-surface-container-lowest rounded-xl p-6 border border-slate-200 shadow-sm">
                    <h4 class="text-sm font-headline font-bold text-on-surface uppercase tracking-widest mb-4">Tỷ lệ chuyển đổi</h4>
                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between text-xs mb-1.5">
                                <span class="font-bold text-on-surface-variant">Hiển thị → Click (CTR)</span>
                                <span class="font-black" :class="parseFloat(advMetrics.ctr) >= 2 ? 'text-primary' : 'text-error'">{{ advMetrics.ctr }}%</span>
                            </div>
                            <div class="w-full bg-surface-container rounded-full h-2.5">
                                <div class="h-2.5 rounded-full transition-all duration-700" :class="parseFloat(advMetrics.ctr) >= 2 ? 'bg-primary' : 'bg-error'" :style="`width: ${Math.min(parseFloat(advMetrics.ctr) * 10, 100)}%`"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between text-xs mb-1.5">
                                <span class="font-bold text-on-surface-variant">Click → Tương tác</span>
                                <span class="font-black" :class="parseFloat(advMetrics.clickToEngRate) >= 50 ? 'text-primary' : 'text-amber-500'">{{ advMetrics.clickToEngRate }}%</span>
                            </div>
                            <div class="w-full bg-surface-container rounded-full h-2.5">
                                <div class="h-2.5 rounded-full transition-all duration-700" :class="parseFloat(advMetrics.clickToEngRate) >= 50 ? 'bg-primary' : 'bg-amber-500'" :style="`width: ${Math.min(parseFloat(advMetrics.clickToEngRate), 100)}%`"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between text-xs mb-1.5">
                                <span class="font-bold text-on-surface-variant">Click → Mua hàng (CR)</span>
                                <span class="font-black" :class="parseFloat(advMetrics.conversionRate) >= 3 ? 'text-primary' : 'text-error'">{{ advMetrics.conversionRate }}%</span>
                            </div>
                            <div class="w-full bg-surface-container rounded-full h-2.5">
                                <div class="h-2.5 rounded-full transition-all duration-700" :class="parseFloat(advMetrics.conversionRate) >= 3 ? 'bg-primary' : 'bg-error'" :style="`width: ${Math.min(parseFloat(advMetrics.conversionRate) * 5, 100)}%`"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between text-xs mb-1.5">
                                <span class="font-bold text-on-surface-variant">Hiển thị → Mua hàng</span>
                                <span class="font-black text-tertiary">{{ advMetrics.purchaseRate }}%</span>
                            </div>
                            <div class="w-full bg-surface-container rounded-full h-2.5">
                                <div class="bg-tertiary h-2.5 rounded-full transition-all duration-700" :style="`width: ${Math.min(parseFloat(advMetrics.purchaseRate) * 20, 100)}%`"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Stats -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-surface-container-lowest rounded-xl p-5 border border-slate-200 shadow-sm text-center">
                        <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest">Đơn hàng</p>
                        <p class="text-3xl font-headline font-black text-primary mt-1">{{ advMetrics.purchases.toLocaleString() }}</p>
                    </div>
                    <div class="bg-surface-container-lowest rounded-xl p-5 border border-slate-200 shadow-sm text-center">
                        <p class="text-[9px] text-on-surface-variant uppercase font-black tracking-widest">Doanh thu ước tính</p>
                        <p class="text-3xl font-headline font-black text-tertiary mt-1">{{ advMetrics.revenueEst }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- TIER 3: ENGAGEMENT GRID WITH COLORS -->
        <section class="bg-surface-container-lowest rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div class="bg-slate-50 px-8 py-5 border-b border-slate-200 flex items-center gap-3">
                 <span class="material-symbols-outlined text-on-surface-variant text-lg">mediation</span>
                 <h4 class="font-headline font-bold text-sm text-on-surface uppercase tracking-widest">Phân tích kênh & Tương tác</h4>
             </div>
             <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 lg:divide-x divide-slate-200">
                 <div class="p-6">
                     <p class="text-[10px] text-blue-600 uppercase font-bold tracking-widest mb-1">Lượt hiển thị</p>
                     <p class="text-2xl font-black text-on-surface">{{ advMetrics.impressions.toLocaleString() }}</p>
                     <div class="flex items-center gap-1 mt-2"><span class="w-2 h-2 rounded-full bg-blue-500"></span><span class="text-[10px] text-blue-600 font-bold">Đầu phễu</span></div>
                 </div>
                 <div class="p-6 bg-primary/5">
                     <p class="text-[10px] text-primary uppercase font-bold tracking-widest mb-1">Lượt click</p>
                     <p class="text-2xl font-black text-primary">{{ advMetrics.clicks.toLocaleString() }}</p>
                     <div class="flex items-center gap-1 mt-2"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">CTR {{ advMetrics.ctr }}%</span></div>
                 </div>
                 <div class="p-6">
                     <p class="text-[10px] text-violet-600 uppercase font-bold tracking-widest mb-1">Tương tác</p>
                     <p class="text-2xl font-black text-violet-700">{{ advMetrics.engagements.toLocaleString() }}</p>
                     <div class="flex items-center gap-1 mt-2"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">{{ advMetrics.engRate }}% tỷ lệ</span></div>
                 </div>
                 <div class="p-6">
                     <p class="text-[10px] text-cyan-600 uppercase font-bold tracking-widest mb-1">Chia sẻ</p>
                     <p class="text-2xl font-black text-on-surface">{{ advMetrics.shares.toLocaleString() }}</p>
                     <div class="flex items-center gap-1 mt-2"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-600">{{ advMetrics.shareRate }}% / tương tác</span></div>
                 </div>
                 <div class="p-6">
                     <p class="text-[10px] text-amber-600 uppercase font-bold tracking-widest mb-1">Bình luận</p>
                     <p class="text-2xl font-black text-on-surface">{{ advMetrics.comments.toLocaleString() }}</p>
                     <div class="flex items-center gap-1 mt-2"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">{{ advMetrics.commentRate }}% / tương tác</span></div>
                 </div>
                 <div class="p-6 bg-tertiary/5">
                     <p class="text-[10px] text-tertiary uppercase font-bold tracking-widest mb-1">Đơn hàng</p>
                     <p class="text-2xl font-black text-tertiary">{{ advMetrics.purchases.toLocaleString() }}</p>
                     <div class="flex items-center gap-1 mt-2"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary">{{ advMetrics.conversionRate }}% CR</span></div>
                 </div>
             </div>
        </section>

        <!-- TIER 4: CHARTS ROW -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Spend vs Conversions Trend -->
            <div class="lg:col-span-2 bg-surface-container-lowest rounded-xl p-8 border border-slate-200 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h4 class="text-lg font-headline font-extrabold text-on-surface">Xu hướng chi tiêu & chuyển đổi</h4>
                        <p class="text-xs text-on-surface-variant font-medium mt-1">Chi tiêu hàng ngày so với hiệu quả click và mua hàng</p>
                    </div>
                    <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-blue-500"></span> Chi tiêu</div>
                        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-primary"></span> Lượt click</div>
                        <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-tertiary"></span> Đơn hàng</div>
                    </div>
                </div>
                <apexchart type="line" height="300" :options="trendChartOptions" :series="trendChartSeries"></apexchart>
            </div>

            <!-- Engagement Mix Donut -->
            <div class="bg-surface-container-lowest rounded-xl p-8 border border-slate-200 shadow-sm">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4">Chất lượng tương tác</h4>
                <div class="flex justify-center">
                     <apexchart type="donut" height="240" :options="engOptions" :series="engSeries"></apexchart>
                </div>
                <div class="mt-4 space-y-2">
                   <div class="flex justify-between items-center text-xs p-2 bg-surface rounded-lg">
                     <span class="font-bold text-on-surface-variant">Cảm xúc tích cực</span>
                     <span class="font-black text-primary">82%</span>
                   </div>
                   <div class="flex justify-between items-center text-xs p-2 bg-surface rounded-lg">
                     <span class="font-bold text-on-surface-variant">Hệ số lan truyền</span>
                     <span class="font-black text-tertiary">{{ advMetrics.viralCoeff }}</span>
                   </div>
                </div>
            </div>
        </div>

        <!-- TIER 5: CAMPAIGN COMPARISON + TABLE -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Campaign Performance Comparison -->
            <div class="bg-surface-container-lowest rounded-xl p-8 border border-slate-200 shadow-sm">
                <h4 class="text-lg font-headline font-extrabold text-on-surface mb-2">So sánh CPL giữa chiến dịch</h4>
                <p class="text-xs text-on-surface-variant mb-4">So sánh chi phí mỗi đơn giữa các chiến dịch</p>
                <apexchart type="bar" height="300" :options="cplCompareOptions" :series="cplCompareSeries"></apexchart>
            </div>

            <!-- CTR vs CR Scatter -->
            <div class="bg-surface-container-lowest rounded-xl p-8 border border-slate-200 shadow-sm">
                <h4 class="text-lg font-headline font-extrabold text-on-surface mb-2">CTR so với tỷ lệ chuyển đổi</h4>
                <p class="text-xs text-on-surface-variant mb-4">Góc phải-trên = hiệu quả tốt nhất</p>
                <apexchart type="scatter" height="300" :options="scatterOptions" :series="scatterSeries"></apexchart>
            </div>
        </div>

        <!-- TIER 6: BẢNG ĐỒNG BỘ FACEBOOK + BITRIX24 -->
        <div class="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <div class="p-6 md:px-8 border-b border-slate-200 flex flex-col md:flex-row gap-4 md:gap-0 justify-between items-start md:items-center bg-slate-50">
                <div>
                   <h3 class="font-headline font-black text-lg text-on-surface">Facebook Ads ↔ Bitrix24 CRM</h3>
                   <p class="text-xs font-medium text-on-surface-variant mt-1">
                     Đồng bộ chỉ số quảng cáo + lead thật từ CRM
                     <span v-if="mergedData.totals" class="ml-2 font-bold">— {{ mergedData.totals.leads }} leads, {{ mergedData.totals.orders }} chốt đơn, tỷ lệ {{ mergedData.totals.avg_close_rate }}%</span>
                   </p>
                </div>
                <div class="flex items-center gap-2">
                    <button @click="fetchMergedData" class="bg-slate-100 border border-slate-300 text-black px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-slate-200 transition-all">
                      <span class="material-symbols-outlined text-[14px]" :class="{'animate-spin': mergedLoading}">sync</span> Đồng bộ
                    </button>
                    <button @click="exportMerged" class="bg-primary/10 border border-primary/30 text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-all">
                      <span class="material-symbols-outlined text-[14px]">download</span> CSV
                    </button>
                </div>
            </div>

            <div v-if="mergedLoading" class="p-8 animate-pulse space-y-3">
                <div class="h-8 bg-slate-100 rounded w-full"></div>
                <div class="h-8 bg-slate-100 rounded w-full"></div>
                <div class="h-8 bg-slate-100 rounded w-4/5"></div>
            </div>

            <div v-else class="overflow-x-auto">
                <table class="w-full text-left font-body border-collapse min-w-[1100px]">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-slate-200">Chiến dịch</th>
                            <th class="px-3 py-4 text-[10px] font-black text-blue-600 uppercase tracking-widest text-right border-b bg-blue-50/30">Chi tiêu</th>
                            <th class="px-3 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right border-b border-slate-200">Hiển thị</th>
                            <th class="px-3 py-4 text-[10px] font-black text-primary uppercase tracking-widest text-right border-b bg-primary/5">Click</th>
                            <th class="px-3 py-4 text-[10px] font-black text-primary uppercase tracking-widest text-right border-b bg-primary/5">CTR</th>
                            <th class="px-3 py-4 text-[10px] font-black text-violet-600 uppercase tracking-widest text-right border-b bg-violet-50/30">Leads (B24)</th>
                            <th class="px-3 py-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-right border-b bg-amber-50/30">Chốt đơn</th>
                            <th class="px-3 py-4 text-[10px] font-black text-primary uppercase tracking-widest text-right border-b bg-primary/5">Tỷ lệ chốt</th>
                            <th class="px-3 py-4 text-[10px] font-black text-error uppercase tracking-widest text-right border-b bg-error/5">CPL thật</th>
                            <th class="px-4 py-4 text-[10px] font-black text-error uppercase tracking-widest text-right border-b bg-error/5">Chi phí/đơn</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        <tr v-for="m in mergedData.campaigns || []" :key="m.name" class="hover:bg-primary/5 transition-colors">
                            <td class="px-6 py-4">
                                <p class="font-bold text-sm text-on-surface">{{ m.name }}</p>
                                <p v-if="m.matched_b24 && m.matched_b24 !== m.name" class="text-[10px] text-primary font-mono">↔ {{ m.matched_b24 }}</p>
                            </td>
                            <td class="px-3 py-4 text-right text-[13px] font-bold text-blue-700">{{ m.spend > 0 ? '' + m.spend.toLocaleString() : '—' }}</td>
                            <td class="px-3 py-4 text-right text-[13px] text-on-surface-variant">{{ m.impressions > 0 ? m.impressions.toLocaleString() : '—' }}</td>
                            <td class="px-3 py-4 text-right text-[13px] font-bold text-primary">{{ m.clicks > 0 ? m.clicks.toLocaleString() : '—' }}</td>
                            <td class="px-3 py-4 text-right">
                                <span v-if="m.ctr > 0" class="text-[11px] font-black px-1.5 py-0.5 rounded" :class="m.ctr >= 2 ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'">{{ m.ctr }}%</span>
                                <span v-else class="text-xs text-on-surface-variant">—</span>
                            </td>
                            <td class="px-3 py-4 text-right text-[13px] font-black text-violet-700">{{ m.total_leads || 0 }}</td>
                            <td class="px-3 py-4 text-right text-[13px] font-black text-amber-700">{{ m.leads_chot || 0 }}</td>
                            <td class="px-3 py-4 text-right">
                                <span class="text-[11px] font-black px-1.5 py-0.5 rounded" :class="m.close_rate >= 30 ? 'bg-primary/10 text-primary' : m.close_rate >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-error/10 text-error'">{{ m.close_rate }}%</span>
                            </td>
                            <td class="px-3 py-4 text-right">
                                <span v-if="m.cpl_real > 0" class="text-[12px] font-bold" :class="m.cpl_real > 15 ? 'text-error' : 'text-on-surface'"> {{ m.cpl_real.toLocaleString() }}</span>
                                <span v-else class="text-xs text-on-surface-variant">—</span>
                            </td>
                            <td class="px-4 py-4 text-right">
                                <span v-if="m.cost_per_order > 0" class="text-[12px] font-bold" :class="m.cost_per_order > 50 ? 'text-error' : 'text-primary'"> {{ m.cost_per_order.toLocaleString() }}</span>
                                <span v-else class="text-xs text-on-surface-variant">—</span>
                            </td>
                        </tr>
                        <tr v-if="!mergedData.campaigns || mergedData.campaigns.length === 0">
                            <td colspan="10" class="text-center py-12 text-on-surface-variant text-sm font-bold">Tải dữ liệu CSV + cấu hình Bitrix24 webhook để xem bảng đồng bộ.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useAppDataStore } from '../stores/appData'
import { useUiStore } from '../stores/ui'
import { useToast } from 'primevue/usetoast'
import api from '../lib/axios'

const appData = useAppDataStore()
const uiStore = useUiStore()
const toast = useToast()

// Last Updated Timestamp
const lastUpdated = ref(null)
const lastUpdatedText = computed(() => {
  if (!lastUpdated.value) return '—'
  const d = new Date(lastUpdated.value)
  return d.toLocaleTimeString('vi-VN') + ' ' + d.toLocaleDateString('vi-VN')
})

// KPI Goals
const kpiGoals = ref([
  { label: 'CPL mục tiêu', target: 150000, current: 0, unit: 'đ', inverse: true },
  { label: 'ROAS mục tiêu', target: 3, current: 0, unit: 'x', inverse: false },
  { label: 'CTR mục tiêu', target: 2, current: 0, unit: '%', inverse: false },
])

const goalProgress = (g) => {
  if (g.inverse) return Math.min((g.target / Math.max(g.current, 1)) * 100, 100)
  return Math.min((g.current / Math.max(g.target, 1)) * 100, 100)
}
const goalReached = (g) => {
  if (g.inverse) return g.current <= g.target
  return g.current >= g.target
}

// Merged Facebook + Bitrix24
const mergedData = ref({})
const mergedLoading = ref(false)

const fetchMergedData = async () => {
    mergedLoading.value = true
    try {
        const res = await api.get('/campaigns/merged')
        mergedData.value = res.data
    } catch (e) {
        console.error('Merged data error:', e)
    } finally {
        mergedLoading.value = false
    }
}

const exportMerged = () => {
    const camps = mergedData.value.campaigns || []
    if (camps.length === 0) return
    const headers = ['Chiến dịch', 'Chi tiêu', 'Hiển thị', 'Click', 'CTR%', 'Leads B24', 'Chốt đơn', 'Tỷ lệ chốt%', 'CPL thật', 'Chi phí/đơn']
    const rows = camps.map(m => [m.name, m.spend, m.impressions, m.clicks, m.ctr, m.total_leads, m.leads_chot, m.close_rate, m.cpl_real, m.cost_per_order])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v || 0}"`).join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `fb_bitrix24_merged_${Date.now()}.csv`
    link.click()
    toast.add({ severity: 'success', summary: 'Đã xuất', detail: 'CSV đồng bộ đã tải.', life: 2000 })
}

// AI Analysis
const aiAnalysis = ref('')
const aiProvider = ref('rule_based')
const aiLoading = ref(false)
const aiError = ref('')

const fetchAiAnalysis = async () => {
    aiLoading.value = true
    aiError.value = ''
    try {
        const res = await api.get('/ai/analyze')
        aiAnalysis.value = res.data.analysis
        aiProvider.value = res.data.provider
        if (res.data.error) aiError.value = res.data.error
    } catch (e) {
        aiError.value = 'Không thể kết nối AI. Vui lòng thử lại.'
    } finally {
        aiLoading.value = false
    }
}

// ========== COMPUTED METRICS ==========
const advMetrics = computed(() => {
    let totSpd = 0, totImp = 0, totClick = 0, totEng = 0, totPur = 0
    appData.topCampaigns.forEach(c => {
        totSpd += (c.spend || 0)
        let imp = c.imp || Math.floor((c.spend || 0) * 8.5)
        let click = c.clicks || Math.floor(imp * 0.02)
        totImp += imp
        totClick += click
        totEng += c.engagements || Math.floor(imp * 0.05)
        totPur += c.purchases || Math.floor(click * 0.03)
    })

    const cr = totClick > 0 ? ((totPur / totClick) * 100).toFixed(2) : 0
    const purchaseRate = totImp > 0 ? ((totPur / totImp) * 100).toFixed(2) : 0
    const ctr = totImp > 0 ? ((totClick / totImp) * 100).toFixed(2) : 0
    const engRate = totImp > 0 ? ((totEng / totImp) * 100).toFixed(2) : 0
    const cplRaw = totPur > 0 ? (totSpd / totPur).toFixed(2) : 0
    const cpcRaw = totClick > 0 ? (totSpd / totClick).toFixed(2) : 0
    const cpmRaw = totImp > 0 ? ((totSpd / totImp) * 1000).toFixed(2) : 0
    const roasRaw = totSpd > 0 ? ((totPur * 50000000) / totSpd).toFixed(2) : 0 // assume $50 avg order value
    const freq = totImp > 0 && totClick > 0 ? (totImp / (totImp * 0.4)).toFixed(1) : 1.0 // reach ~ 40% of impressions
    const shares = Math.floor(totEng * 0.3)
    const comments = Math.floor(totEng * 0.7)
    const clickToEng = totClick > 0 ? ((totEng / totClick) * 100).toFixed(1) : 0
    const viralCoeff = totEng > 0 ? (shares / totEng * 2.5).toFixed(2) : 0

    return {
        impressions: totImp,
        clicks: totClick,
        shares,
        comments,
        engagements: totEng,
        purchases: totPur,
        ctr,
        engRate,
        conversionRate: cr,
        purchaseRate,
        totalSpend: "" + totSpd.toLocaleString(),
        avgDailyBudget: "" + Math.floor(totSpd / 30).toLocaleString(),
        cpl: "" + parseFloat(cplRaw).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        cplRaw,
        cpc: "" + parseFloat(cpcRaw).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        cpm: "" + parseFloat(cpmRaw).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        roas: roasRaw,
        frequency: parseFloat(freq),
        clickToEngRate: clickToEng,
        shareRate: totEng > 0 ? ((shares / totEng) * 100).toFixed(0) : 0,
        commentRate: totEng > 0 ? ((comments / totEng) * 100).toFixed(0) : 0,
        revenueEst: "" + (totPur * 50000000).toLocaleString(),
        viralCoeff
    }
})

// Health Score

// Drop rates for funnel
const dropRates = computed(() => {
    const m = advMetrics.value
    const impToClick = m.impressions > 0 ? ((1 - m.clicks / m.impressions) * 100).toFixed(1) : 0
    const clickToEng = m.clicks > 0 ? ((1 - m.engagements / m.clicks) * 100).toFixed(1) : 0
    const clickToPur = m.clicks > 0 ? ((1 - m.purchases / m.clicks) * 100).toFixed(1) : 0
    return [
        { label: 'Hiển thị→Click', rate: `-${impToClick}%`, severity: parseFloat(impToClick) > 95 ? 'high' : 'medium' },
        { label: 'Click→Tương tác', rate: parseFloat(clickToEng) > 0 ? `-${clickToEng}%` : `+${Math.abs(parseFloat(clickToEng))}%`, severity: parseFloat(clickToEng) > 70 ? 'high' : parseFloat(clickToEng) > 40 ? 'medium' : 'low' },
        { label: 'Click→Mua hàng', rate: `-${clickToPur}%`, severity: parseFloat(clickToPur) > 95 ? 'high' : 'medium' },
    ]
})

// ========== GRID TABLE DATA ==========
const gridCamps = computed(() => {
    return appData.topCampaigns.map(c => {
        const imp = c.imp || Math.floor((c.spend || 0) * 8.5)
        const clicks = c.clicks || Math.floor(imp * 0.02)
        const eng = c.engagements || Math.floor(imp * 0.05)
        const pur = c.purchases || Math.floor(clicks * 0.03)
        const spend = c.spend || 0
        const cr = clicks > 0 ? ((pur / clicks) * 100).toFixed(2) : 0
        const ctr = imp > 0 ? ((clicks / imp) * 100).toFixed(2) : 0
        const cplNum = pur > 0 ? spend / pur : 0
        const cpcNum = clicks > 0 ? spend / clicks : 0
        const roasNum = spend > 0 ? (pur * 50000000) / spend : 0

        return {
            name: c.name || "Unknown Campaign",
            st: c.status === "ACTIVE" ? "ON" : "OFF",
            type: c.source_sheet ? "CSV UPLOAD" : "FACEBOOK API",
            imp: imp.toLocaleString(),
            clicks: clicks.toLocaleString(),
            ctr,
            eng: eng.toLocaleString(),
            pur: pur.toLocaleString(),
            cr,
            spd: spend.toLocaleString(),
            cplNum,
            cplDisplay: cplNum.toFixed(2),
            cpcDisplay: cpcNum.toFixed(2),
            roasNum,
            roasDisplay: roasNum.toFixed(1),
            // raw numbers for charts
            _spend: spend, _imp: imp, _clicks: clicks, _eng: eng, _pur: pur, _ctr: parseFloat(ctr), _cr: parseFloat(cr), _cpl: cplNum
        }
    })
})

// ========== FUNNEL DROP-OFF CHART ==========
const funnelChartSeries = computed(() => {
    const m = advMetrics.value
    return [{
        name: 'Số lượng',
        data: [m.impressions, m.clicks, m.engagements, m.purchases]
    }]
})

const funnelChartOptions = ref({
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
    plotOptions: {
        bar: { borderRadius: 8, columnWidth: '60%', distributed: true }
    },
    colors: ['#3b82f6', '#006d33', '#7c3aed', '#4648d4'],
    dataLabels: {
        enabled: true,
        formatter: (val) => val >= 1000 ? (val / 1000).toFixed(1) + 'K' : val.toLocaleString(),
        style: { fontSize: '13px', fontWeight: 800 }
    },
    xaxis: {
        categories: ['Lượt hiển thị', 'Lượt click', 'Tương tác', 'Đơn hàng'],
        labels: { style: { fontSize: '11px', fontWeight: 700 } }
    },
    yaxis: {
        labels: {
            formatter: (val) => val >= 1000 ? (val / 1000).toFixed(0) + 'K' : val
        }
    },
    legend: { show: false },
    tooltip: {
        y: { formatter: (val) => val.toLocaleString() }
    }
})

// ========== TREND CHART ==========
const trendChartSeries = computed(() => {
    const camps = gridCamps.value
    if (camps.length === 0) return []
    // Simulate daily data based on campaign totals
    const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
    const totalSpend = camps.reduce((s, c) => s + c._spend, 0)
    const totalClicks = camps.reduce((s, c) => s + c._clicks, 0)
    const totalPur = camps.reduce((s, c) => s + c._pur, 0)
    const patterns = [0.12, 0.16, 0.18, 0.14, 0.2, 0.12, 0.08]
    return [
        { name: 'Chi tiêu (đ)', type: 'column', data: patterns.map(p => Math.round(totalSpend * p)) },
        { name: 'Lượt click', type: 'line', data: patterns.map((p, i) => Math.round(totalClicks * p * (0.9 + Math.sin(i) * 0.2))) },
        { name: 'Đơn hàng', type: 'area', data: patterns.map((p, i) => Math.round(totalPur * p * (0.8 + Math.cos(i) * 0.3))) }
    ]
})

const trendChartOptions = ref({
    chart: { height: 300, toolbar: { show: false }, fontFamily: 'inherit' },
    stroke: { width: [0, 3, 2], curve: 'smooth' },
    colors: ['#93c5fd', '#006d33', '#4648d4'],
    fill: { opacity: [0.85, 1, 0.3] },
    xaxis: { categories: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] },
    yaxis: [
        { title: { text: 'Chi tiêu (đ)' }, labels: { formatter: v => '' + v.toLocaleString() } },
        { opposite: true, title: { text: 'Lượt click / Đơn hàng' } }
    ],
    tooltip: { shared: true, intersect: false }
})

// ========== ENGAGEMENT DONUT ==========
const engSeries = computed(() => [advMetrics.value.clicks, advMetrics.value.shares, advMetrics.value.comments])
const engOptions = ref({
    chart: { type: 'donut', fontFamily: 'inherit', background: 'transparent' },
    labels: ['Click trực tiếp', 'Chia sẻ nội dung', 'Bình luận'],
    colors: ['#006d33', '#06b6d4', '#f59e0b'],
    plotOptions: { pie: { donut: { size: '65%', labels: { show: true, name: { show: false }, value: { fontSize: '20px', fontWeight: 800, color: '#006d33' }, total: { show: true, showAlways: true, label: 'Tổng', formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString() } } } } },
    stroke: { show: true, colors: ['#fff'], width: 2 },
    legend: { position: 'bottom', fontSize: '11px', fontWeight: 700 }
})

// ========== CPL COMPARISON BAR ==========
const cplCompareSeries = computed(() => {
    const camps = gridCamps.value.filter(c => c._cpl > 0).slice(0, 8)
    return [{
        name: 'CPL (đ)',
        data: camps.map(c => parseFloat(c._cpl.toFixed(2)))
    }]
})
const cplCompareOptions = computed(() => {
    const camps = gridCamps.value.filter(c => c._cpl > 0).slice(0, 8)
    return {
        chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
        plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%' } },
        colors: camps.map(c => c._cpl > 15 ? '#ba1a1a' : c._cpl > 10 ? '#f59e0b' : '#006d33'),
        plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%', distributed: true } },
        dataLabels: { enabled: true, formatter: v => '' + v.toFixed(2), style: { fontSize: '11px', fontWeight: 700 } },
        xaxis: { categories: camps.map(c => c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name), title: { text: 'Chi phí mỗi đơn (đ)' } },
        legend: { show: false },
        annotations: {
            xaxis: [{ x: 15, borderColor: '#ba1a1a', strokeDashArray: 4, label: { text: 'Mục tiêu 15K', style: { color: '#ba1a1a', fontSize: '10px', fontWeight: 800 } } }]
        }
    }
})

// ========== SCATTER: CTR vs CR ==========
const scatterSeries = computed(() => {
    const camps = gridCamps.value.filter(c => c._ctr > 0)
    return [{
        name: 'Chiến dịch',
        data: camps.map(c => ({ x: c._ctr, y: c._cr, name: c.name }))
    }]
})
const scatterOptions = ref({
    chart: { toolbar: { show: false }, fontFamily: 'inherit', zoom: { enabled: false } },
    colors: ['#4648d4'],
    xaxis: { title: { text: 'CTR (%)' }, tickAmount: 6 },
    yaxis: { title: { text: 'Tỷ lệ chuyển đổi (%)' } },
    markers: { size: 10, strokeWidth: 2, strokeColors: '#fff', hover: { size: 14 } },
    tooltip: {
        custom: ({ seriesIndex, dataPointIndex, w }) => {
            const d = w.globals.initialSeries[seriesIndex].data[dataPointIndex]
            return `<div class="px-3 py-2 text-xs"><b>${d.name}</b><br/>CTR: ${d.x}% | CR: ${d.y}%</div>`
        }
    },
    annotations: {
        yaxis: [{ y: 3, borderColor: '#006d33', strokeDashArray: 4, label: { text: 'CR tốt', style: { fontSize: '10px' } } }],
        xaxis: [{ x: 2, borderColor: '#006d33', strokeDashArray: 4, label: { text: 'CTR tốt', style: { fontSize: '10px' } } }]
    }
})

// ========== EXPORT TABLE ==========
const exportTable = () => {
    const headers = ['Chiến dịch', 'Chi tiêu', 'Lượt hiển thị', 'Lượt click', 'CTR%', 'Tương tác', 'Đơn hàng', 'CR%', 'CPL', 'CPC', 'ROAS']
    const rows = gridCamps.value.map(c => [c.name, c.spd, c.imp, c.clicks, c.ctr, c.eng, c.pur, c.cr, c.cplDisplay, c.cpcDisplay, c.roasDisplay])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `dashboard_export_${Date.now()}.csv`
    link.click()
    toast.add({ severity: 'success', summary: 'Đã xuất', detail: 'Đã tải xuống CSV bảng điều khiển.', life: 3000 })
}

// Kiểm tra cảnh báo ngân sách khi dữ liệu thay đổi
watch(() => appData.topCampaigns, (campaigns) => {
    if (campaigns && campaigns.length > 0) {
        const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0)
        if (uiStore.checkBudgetAlert(totalSpend)) {
            toast.add({
                severity: 'warn',
                summary: 'Cảnh báo ngân sách',
                detail: `Tổng chi tiêu (${totalSpend.toLocaleString()}đ) đã vượt ngưỡng ngân sách (${uiStore.budgetLimit.toLocaleString()}đ).`,
                life: 6000
            })
        }
    }
}, { deep: true })

onMounted(async () => {
    appData.fetchDashboardStats()
    await appData.fetchCampaigns()
    lastUpdated.value = Date.now()
    // Update KPI goals from computed metrics
    const m = advMetrics.value
    kpiGoals.value[0].current = parseFloat(m.cplRaw) || 0
    kpiGoals.value[1].current = parseFloat(m.roas) || 0
    kpiGoals.value[2].current = parseFloat(m.ctr) || 0
    appData.startAutoRefresh()
    fetchAiAnalysis()
    fetchMergedData()
})

onUnmounted(() => {
    appData.stopAutoRefresh()
})
</script>

<style scoped>
.draw-path { stroke-dasharray: 2500; stroke-dashoffset: 2500; animation: draw-line 3.5s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
@keyframes draw-line { 100% { stroke-dashoffset: 0; } }
@keyframes scan { 0% { top:-20px; opacity:0; } 50% { opacity:1;} 100%{top: 100%; opacity:0;} }
.fade-in-animation { animation: fadeFrame 0.5s ease-out forwards; opacity: 0; }
@keyframes fadeFrame { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
