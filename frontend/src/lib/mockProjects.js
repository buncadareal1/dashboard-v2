/**
 * Mock data cho Phase A — 6 dự án bất động sản theo Readdy.ai preview.
 * Mỗi project có thêm field `detail` chứa toàn bộ dữ liệu render trang
 * /projects/:id (KPI, revenue chart, funnel, units, campaigns, creatives).
 *
 * Sẽ được thay bằng API `/api/projects/:id` ở Phase B (backend extension).
 *
 * @see ./realEstateTypes.js
 */

const employees = [
    { id: 'emp-1', name: 'Nguyễn Văn A', initial: 'A' },
    { id: 'emp-2', name: 'Trần Thị B', initial: 'B' },
    { id: 'emp-3', name: 'Lê Văn C', initial: 'C' },
    { id: 'emp-4', name: 'Phạm Thị D', initial: 'D' },
    { id: 'emp-5', name: 'Hoàng Văn E', initial: 'E' },
    { id: 'emp-6', name: 'Đỗ Văn F', initial: 'F' },
]

/**
 * Build the per-project funnel from leadCount → bookingCount.
 * Stages match Readdy: Lead → Contacted (75%) → Qualified (F1) → Visit (60% of F1) → Booking.
 */
function buildFunnel(leadCount, f1Count, bookingCount) {
    const contacted = Math.round(leadCount * 0.75)
    const visit = Math.round(f1Count * 0.6)
    const stages = [
        { label: 'Lead', count: leadCount },
        { label: 'Contacted', count: contacted },
        { label: 'Qualified (F1)', count: f1Count },
        { label: 'Visit', count: visit },
        { label: 'Booking', count: bookingCount },
    ]
    return stages.map((s) => ({
        ...s,
        pct: Math.round((s.count / leadCount) * 100),
    }))
}

export const MOCK_PROJECTS = Object.freeze([
    {
        id: 'vinhomes-grand-park',
        name: 'Vinhomes Grand Park',
        location: 'Quận 9, TP.HCM',
        status: 'running',
        owner: employees[0],
        totalUnits: 250,
        soldUnits: 87,
        totalBudget: 850_000_000,
        totalRevenue: 12_450_000_000,
        dealCount: 87,
        bookingCount: 142,
        f1Count: 418,
        leadCount: 1247,
        channels: ['facebook', 'google'],
        detail: {
            revenueMonths: ['T10/2023', 'T11/2023', 'T12/2023', 'T1/2024', 'T2/2024', 'T3/2024'],
            revenueSeries: [185, 198, 215, 208, 225, 214],
            funnel: buildFunnel(1247, 418, 142),
            units: [
                { date: '15/03/2024', code: 'VH-A-0101', source: 'Facebook Ads', revenue: '3.2B', staff: 'Nguyễn Văn A' },
                { date: '18/03/2024', code: 'VH-A-0102', source: 'Facebook Ads', revenue: '3.2B', staff: 'Nguyễn Văn A' },
                { date: '25/03/2024', code: 'VH-A-0105', source: 'Facebook Ads', revenue: '4.1B', staff: 'Nguyễn Văn A' },
                { date: '28/03/2024', code: 'VH-B-0201', source: 'Facebook Ads', revenue: '3.5B', staff: 'Nguyễn Văn A' },
                { date: '05/04/2024', code: 'VH-B-0204', source: 'Facebook Ads', revenue: '6.2B', staff: 'Nguyễn Văn A' },
                { date: '08/04/2024', code: 'VH-B-0205', source: 'Facebook Ads', revenue: '4.5B', staff: 'Nguyễn Văn A' },
            ],
            campaigns: [
                { name: 'Vinhomes Grand Park - Q4 2024', spend: '320M', impressions: '2.4M', ctr: '2.8%', lead: 720, f1: 540, qualify: '75%', cpl: '444K', efficiency: 'Tốt', status: 'running' },
            ],
            creatives: [
                { title: 'Lead Form - Nhận báo giá ngay', type: 'Lead Form', tagline: 'Nhận báo giá & ưu đãi độc quyền hôm nay', f1: 193, booking: 28, leads: 276, ctr: '2.5%', cpl: '450K', score: 91, rank: 'Xuất sắc' },
                { title: 'Video Tour 360° - Căn hộ mẫu 2PN', type: 'Video', tagline: 'Sở hữu căn hộ 2PN từ 2.8 tỷ - Vinhomes Grand Park', f1: 186, booking: 24, leads: 248, ctr: '3%', cpl: '470K', score: 95, rank: 'Xuất sắc' },
                { title: 'Carousel - Tiện ích nội khu', type: 'Carousel', tagline: 'Hơn 50 tiện ích đẳng cấp ngay trong khu đô thị', f1: 137, booking: 18, leads: 196, ctr: '2.7%', cpl: '510K', score: 88, rank: 'Tốt' },
                { title: 'Retargeting - Khách đã xem website', type: 'Single Image', tagline: 'Bạn đã xem Vinhomes Grand Park? Đừng bỏ lỡ ưu đãi cuối năm!', f1: 129, booking: 15, leads: 198, ctr: '3.4%', cpl: '480K', score: 82, rank: 'Tốt' },
            ],
        },
    },
    {
        id: 'masteri-waterfront',
        name: 'Masteri Waterfront',
        location: 'Quận 2, TP.HCM',
        status: 'running',
        owner: employees[1],
        totalUnits: 180,
        soldUnits: 64,
        totalBudget: 620_000_000,
        totalRevenue: 8_920_000_000,
        dealCount: 64,
        bookingCount: 98,
        f1Count: 298,
        leadCount: 892,
        channels: ['tiktok', 'facebook'],
        detail: {
            revenueMonths: ['T10/2023', 'T11/2023', 'T12/2023', 'T1/2024', 'T2/2024', 'T3/2024'],
            revenueSeries: [142, 138, 155, 148, 162, 147],
            funnel: buildFunnel(892, 298, 64),
            units: [
                { date: '10/03/2024', code: 'MW-A-0801', source: 'TikTok Ads', revenue: '2.8B', staff: 'Trần Thị B' },
                { date: '14/03/2024', code: 'MW-A-0802', source: 'Facebook Ads', revenue: '3.1B', staff: 'Trần Thị B' },
                { date: '22/03/2024', code: 'MW-B-0901', source: 'TikTok Ads', revenue: '4.5B', staff: 'Trần Thị B' },
                { date: '02/04/2024', code: 'MW-B-0903', source: 'Facebook Ads', revenue: '3.8B', staff: 'Trần Thị B' },
            ],
            campaigns: [
                { name: 'Masteri Waterfront - Spring 2024', spend: '210M', impressions: '1.6M', ctr: '2.4%', lead: 480, f1: 320, qualify: '67%', cpl: '438K', efficiency: 'Tốt', status: 'running' },
            ],
            creatives: [
                { title: 'TikTok Reels - View sông Sài Gòn', type: 'Video', tagline: 'Căn hộ view sông từ 2.5 tỷ - Masteri Waterfront', f1: 142, booking: 22, leads: 198, ctr: '3.1%', cpl: '420K', score: 92, rank: 'Xuất sắc' },
                { title: 'Carousel - Mặt bằng 2PN/3PN', type: 'Carousel', tagline: 'Layout linh hoạt cho gia đình trẻ', f1: 96, booking: 14, leads: 156, ctr: '2.6%', cpl: '460K', score: 85, rank: 'Tốt' },
                { title: 'Lead Form - Đăng ký xem nhà mẫu', type: 'Lead Form', tagline: 'Đăng ký nhận lịch xem nhà mẫu cuối tuần', f1: 60, booking: 10, leads: 138, ctr: '2.2%', cpl: '510K', score: 78, rank: 'Trung bình' },
            ],
        },
    },
    {
        id: 'metropole-thu-thiem',
        name: 'The Metropole Thu Thiem',
        location: 'Thủ Thiêm, TP.HCM',
        status: 'warning',
        owner: employees[2],
        totalUnits: 160,
        soldUnits: 52,
        totalBudget: 480_000_000,
        totalRevenue: 7_560_000_000,
        dealCount: 52,
        bookingCount: 68,
        f1Count: 215,
        leadCount: 654,
        channels: ['google', 'youtube'],
        detail: {
            revenueMonths: ['T10/2023', 'T11/2023', 'T12/2023', 'T1/2024', 'T2/2024', 'T3/2024'],
            revenueSeries: [118, 125, 132, 128, 135, 118],
            funnel: buildFunnel(654, 215, 52),
            units: [
                { date: '05/03/2024', code: 'MT-A-1201', source: 'Google Ads', revenue: '4.2B', staff: 'Lê Văn C' },
                { date: '08/03/2024', code: 'MT-A-1202', source: 'Google Ads', revenue: '5.8B', staff: 'Lê Văn C' },
                { date: '18/03/2024', code: 'MT-B-1301', source: 'YouTube Ads', revenue: '8.5B', staff: 'Lê Văn C' },
                { date: '20/03/2024', code: 'MT-B-1302', source: 'Google Ads', revenue: '6.2B', staff: 'Lê Văn C' },
            ],
            campaigns: [
                { name: 'Metropole - Search Brand', spend: '180M', impressions: '950K', ctr: '3.2%', lead: 360, f1: 220, qualify: '61%', cpl: '500K', efficiency: 'Trung bình', status: 'warning' },
            ],
            creatives: [
                { title: 'Search Ad - Căn hộ Thủ Thiêm cao cấp', type: 'Search', tagline: 'Sở hữu căn hộ trung tâm Thủ Thiêm', f1: 110, booking: 16, leads: 168, ctr: '4.1%', cpl: '480K', score: 86, rank: 'Tốt' },
                { title: 'YouTube Bumper - Lifestyle', type: 'Video', tagline: 'Phong cách sống thượng lưu', f1: 70, booking: 10, leads: 124, ctr: '2.8%', cpl: '540K', score: 80, rank: 'Tốt' },
                { title: 'Display - Tiện ích nội khu', type: 'Display', tagline: 'Hệ tiện ích 5 sao nội khu', f1: 35, booking: 6, leads: 98, ctr: '1.9%', cpl: '610K', score: 70, rank: 'Trung bình' },
            ],
        },
    },
    {
        id: 'eco-green-saigon',
        name: 'Eco Green Saigon',
        location: 'Quận 7, TP.HCM',
        status: 'running',
        owner: employees[3],
        totalUnits: 140,
        soldUnits: 48,
        totalBudget: 320_000_000,
        totalRevenue: 5_680_000_000,
        dealCount: 48,
        bookingCount: 62,
        f1Count: 178,
        leadCount: 512,
        channels: ['facebook'],
        detail: {
            revenueMonths: ['T10/2023', 'T11/2023', 'T12/2023', 'T1/2024', 'T2/2024', 'T3/2024'],
            revenueSeries: [92, 88, 98, 95, 102, 93],
            funnel: buildFunnel(512, 178, 48),
            units: [
                { date: '02/03/2024', code: 'EG-C-0801', source: 'Facebook Ads', revenue: '2.8B', staff: 'Phạm Thị D' },
                { date: '05/03/2024', code: 'EG-C-0802', source: 'Facebook Ads', revenue: '2.8B', staff: 'Phạm Thị D' },
                { date: '15/03/2024', code: 'EG-D-0901', source: 'Facebook Ads', revenue: '4.2B', staff: 'Phạm Thị D' },
            ],
            campaigns: [
                { name: 'Eco Green - Awareness', spend: '120M', impressions: '850K', ctr: '2.1%', lead: 280, f1: 165, qualify: '59%', cpl: '428K', efficiency: 'Tốt', status: 'running' },
            ],
            creatives: [
                { title: 'Video - Sống xanh giữa Sài Gòn', type: 'Video', tagline: 'Không gian xanh giữa lòng Quận 7', f1: 92, booking: 14, leads: 152, ctr: '2.7%', cpl: '410K', score: 88, rank: 'Tốt' },
                { title: 'Carousel - 5 lý do chọn Eco Green', type: 'Carousel', tagline: '5 lý do khiến gia đình trẻ chọn Eco Green', f1: 56, booking: 8, leads: 118, ctr: '2.3%', cpl: '450K', score: 80, rank: 'Tốt' },
                { title: 'Lead Form - Tư vấn miễn phí', type: 'Lead Form', tagline: 'Đăng ký tư vấn căn hộ phù hợp', f1: 30, booking: 6, leads: 92, ctr: '2.0%', cpl: '500K', score: 74, rank: 'Trung bình' },
            ],
        },
    },
    {
        id: 'sunshine-city',
        name: 'Sunshine City',
        location: 'Hà Nội',
        status: 'paused',
        owner: employees[4],
        totalUnits: 120,
        soldUnits: 42,
        totalBudget: 280_000_000,
        totalRevenue: 4_850_000_000,
        dealCount: 42,
        bookingCount: 58,
        f1Count: 175,
        leadCount: 542,
        channels: ['zalo', 'facebook'],
        detail: {
            revenueMonths: ['T10/2023', 'T11/2023', 'T12/2023', 'T1/2024', 'T2/2024', 'T3/2024'],
            revenueSeries: [78, 82, 85, 80, 88, 72],
            funnel: buildFunnel(542, 175, 42),
            units: [
                { date: '01/03/2024', code: 'SC-E-1001', source: 'Zalo Ads', revenue: '3.1B', staff: 'Hoàng Văn E' },
                { date: '06/03/2024', code: 'SC-E-1002', source: 'Facebook Ads', revenue: '4.0B', staff: 'Hoàng Văn E' },
            ],
            campaigns: [],
            creatives: [
                { title: 'Zalo Article - Sống tại Hà Nội', type: 'Article', tagline: 'Lựa chọn căn hộ thông minh tại Hà Nội', f1: 80, booking: 12, leads: 142, ctr: '2.0%', cpl: '380K', score: 84, rank: 'Tốt' },
                { title: 'Facebook Lead Ads - Mở bán đợt 2', type: 'Lead Form', tagline: 'Ưu đãi đợt mở bán mới', f1: 60, booking: 9, leads: 118, ctr: '2.4%', cpl: '420K', score: 78, rank: 'Trung bình' },
                { title: 'Carousel - View hồ Tây', type: 'Carousel', tagline: 'Tầm nhìn hồ Tây huyền thoại', f1: 35, booking: 5, leads: 88, ctr: '1.9%', cpl: '460K', score: 71, rank: 'Trung bình' },
            ],
        },
    },
    {
        id: 'manor-central-park',
        name: 'The Manor Central Park',
        location: 'Quận Bình Thạnh, TP.HCM',
        status: 'running',
        owner: employees[5],
        totalUnits: 165,
        soldUnits: 58,
        totalBudget: 450_000_000,
        totalRevenue: 7_120_000_000,
        dealCount: 58,
        bookingCount: 82,
        f1Count: 245,
        leadCount: 728,
        channels: ['google', 'facebook'],
        detail: {
            revenueMonths: ['T10/2023', 'T11/2023', 'T12/2023', 'T1/2024', 'T2/2024', 'T3/2024'],
            revenueSeries: [112, 118, 125, 120, 128, 109],
            funnel: buildFunnel(728, 245, 58),
            units: [
                { date: '03/03/2024', code: 'MC-F-1101', source: 'Google Ads', revenue: '3.4B', staff: 'Đỗ Văn F' },
                { date: '07/03/2024', code: 'MC-F-1102', source: 'Facebook Ads', revenue: '4.5B', staff: 'Đỗ Văn F' },
                { date: '19/03/2024', code: 'MC-G-1201', source: 'Google Ads', revenue: '7.8B', staff: 'Đỗ Văn F' },
            ],
            campaigns: [
                { name: 'Manor - Performance Max', spend: '160M', impressions: '1.2M', ctr: '2.6%', lead: 410, f1: 250, qualify: '61%', cpl: '390K', efficiency: 'Tốt', status: 'running' },
            ],
            creatives: [
                { title: 'PMax - Premium Living', type: 'Performance Max', tagline: 'Cuộc sống đẳng cấp tại Bình Thạnh', f1: 120, booking: 18, leads: 198, ctr: '2.9%', cpl: '380K', score: 90, rank: 'Xuất sắc' },
                { title: 'Carousel - Mẫu nhà 3PN', type: 'Carousel', tagline: 'Không gian sống 3PN rộng rãi', f1: 78, booking: 12, leads: 156, ctr: '2.5%', cpl: '420K', score: 83, rank: 'Tốt' },
                { title: 'Lead Form - Nhận chính sách', type: 'Lead Form', tagline: 'Nhận ngay chính sách bán hàng mới', f1: 47, booking: 8, leads: 122, ctr: '2.1%', cpl: '460K', score: 76, rank: 'Trung bình' },
            ],
        },
    },
])

export const MOCK_EMPLOYEES = Object.freeze(employees)
