import './assets/main.css'
import 'primeicons/primeicons.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Plugins
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'
import ToastService from 'primevue/toastservice'
import VueApexCharts from 'vue3-apexcharts'

// Override Aura preset with emerald primary (Readdy palette #10B981)
const SmartLandPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{emerald.50}',
            100: '{emerald.100}',
            200: '{emerald.200}',
            300: '{emerald.300}',
            400: '{emerald.400}',
            500: '{emerald.500}',
            600: '{emerald.600}',
            700: '{emerald.700}',
            800: '{emerald.800}',
            900: '{emerald.900}',
            950: '{emerald.950}',
        },
    },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ToastService)
app.use(VueApexCharts)
app.use(PrimeVue, {
    theme: {
        preset: SmartLandPreset,
        options: {
            darkModeSelector: '.never-dark', // disable dark mode (Readdy is light-only)
            cssLayer: false,
        },
    },
})

app.component('apexchart', VueApexCharts)

app.config.errorHandler = (err, instance, info) => {
    // eslint-disable-next-line no-console
    console.error(`[Vue Error] ${info}:`, err)
}

window.addEventListener('unhandledrejection', (event) => {
    // eslint-disable-next-line no-console
    console.error('[Unhandled Promise]:', event.reason)
    event.preventDefault()
})

app.mount('#app')
