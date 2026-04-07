/**
 * Central API helpers for the SmartLand dashboard.
 *
 * Reuses the existing axios instance in `./axios.js` (which already wires
 * the auth token interceptor + 401 handling). Each helper returns the raw
 * axios response, so callers do `const { data } = await fetchX()`.
 *
 * All helpers should be side-effect free and never throw mock data — the
 * caller is responsible for catching errors and falling back to inline mock.
 */
import api from './axios'

// ---------- Dashboard ----------
export const fetchDashboardStats = () => api.get('/dashboard-stats')

// ---------- Projects ----------
export const fetchProjects = () => api.get('/projects')
export const fetchProjectDetail = (id) => api.get(`/projects/${id}`)
export const fetchProjectUnits = (id) => api.get(`/projects/${id}/units`)

// ---------- Leads / CRM ----------
export const fetchLeads = (params = {}) => api.get('/leads', { params })

// ---------- Campaigns ----------
export const fetchMergedCampaigns = () => api.get('/campaigns/merged')
export const fetchCampaignTimeseries = (id) => api.get(`/campaigns/${id}/timeseries`)

// ---------- Analytics ----------
export const fetchAnalyticsMarketing = (params = {}) =>
  api.get('/analytics/marketing', { params })
export const fetchAnalyticsMarketingSummary = (params = {}) =>
  api.get('/analytics/marketing/summary', { params })
export const fetchAnalyticsDashboardCampaigns = () =>
  api.get('/analytics/dashboard-campaigns')
export const fetchAnalyticsFbBitrix24 = (params = {}) =>
  api.get('/analytics/fb-bitrix24', { params })

// ---------- Settings / Integrations ----------
export const fetchSettingsIntegrations = () => api.get('/settings/integrations')
export const saveFacebookIntegration = (payload) =>
  api.post('/settings/integrations/facebook', payload)
export const saveSheetIntegration = (payload) =>
  api.post('/settings/integrations/google-sheet', payload)
export const previewFacebookCsv = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/settings/integrations/facebook-csv/preview', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const importFacebookCsv = (file, accountId) => {
  const fd = new FormData()
  fd.append('file', file)
  if (accountId != null) fd.append('account_id', String(accountId))
  return api.post('/settings/integrations/facebook-csv/import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ---------- Bitrix24 ----------
export const saveBitrix24Integration = (webhookUrl) =>
  api.post('/settings/integrations/bitrix24', { webhook_url: webhookUrl })
export const testBitrix24Connection = () =>
  api.post('/settings/integrations/bitrix24/test')
export const syncBitrix24LeadsNow = () => api.get('/bitrix24/leads')

// ---------- Admin ----------
export const fetchAdminUsers = () => api.get('/admin/users')
export const createAdminUser = (payload) => api.post('/admin/users', payload)
export const updateAdminUser = (id, payload) => api.put(`/admin/users/${id}`, payload)
export const fetchUserCampaigns = (userId) => api.get(`/admin/users/${userId}/campaigns`)
export const assignCampaignToUser = (campaignId, userId) =>
  api.post(`/admin/campaigns/${campaignId}/assign`, { user_id: userId })
export const bulkAssignCampaigns = (userId, campaignIds) =>
  api.post('/admin/campaigns/bulk-assign', { user_id: userId, campaign_ids: campaignIds })
export const assignLead = (leadId, userId) =>
  api.post(`/admin/leads/${leadId}/assign`, { user_id: userId })
