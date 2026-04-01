import './assets/main.css'
import 'primeicons/primeicons.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Plugins
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import VueApexCharts from "vue3-apexcharts"

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ToastService)
app.use(VueApexCharts)
app.use(PrimeVue, {
    theme: { preset: Aura, options: { darkModeSelector: '.dark' } }
})

app.component('apexchart', VueApexCharts)
app.mount('#app')