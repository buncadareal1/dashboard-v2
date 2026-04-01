<template>
  <div class="min-h-screen bg-surface flex items-center justify-center">
    <div class="text-center space-y-6 p-8">
      <span class="material-symbols-outlined text-[120px] text-slate-200">explore_off</span>
      <h1 class="text-6xl font-headline font-black text-on-surface">404</h1>
      <p class="text-lg text-on-surface-variant font-medium">Trang bạn tìm không tồn tại</p>
      <router-link to="/" class="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/20 transition-all">
        <span class="material-symbols-outlined text-[18px]">home</span> Về trang chủ
      </router-link>
    </div>
  </div>
</template>
