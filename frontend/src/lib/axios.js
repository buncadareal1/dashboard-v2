import axios from 'axios'

// Cấu hình Axios cơ bản
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
        'Content-Type': 'application/json'
    }
})

// Tự động đính kèm Token nếu có (dành cho API yêu cầu đăng nhập)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Bắt lỗi 401 Global để log out khi token hết hạn hoặc không hợp lệ
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('username')
            // Chuyển hướng người dùng về trang login
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

export default api
