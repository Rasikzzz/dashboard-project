// ============================================================
//  MAIL BPO · VIEWER  –  app.js (Live)
//  Nothing Phone aesthetic – neon green, minimal.
// ============================================================

let DATA = null;
let currentView = 'overall';
let charts = {};
let refreshInterval = null;

// ---- DOM refs ----
const pageTitle       = document.getElementById('page-title');
const kpiGrid         = document.getElementById('kpi-grid');
const stateChart      = document.getElementById('stateChart');
const itemChart       = document.getElementById('itemChart');
const monthlyChart    = document.getElementById('monthlyChart');
const tableBody       = document.getElementById('table-body');
const tableTitle      = document.getElementById('table-title');
const inspectorList   = document.getElementById('inspector-list');
const totalOrdersFooter = document.getElementById('total-orders-footer');
const lastUpdated     = document.getElementById('last-updated');
const dateRangeEl     = document.getElementById('date-range');

const stateChartTitle   = document.getElementById('stateChartTitle');
const itemChartTitle    = document.getElementById('itemChartTitle');
const monthlyChartTitle = document.getElementById('monthlyChartTitle');

// ---- Utilities ----
function round(val, digits = 2) {
    return Number(val.toFixed(digits));
}

function cleanInspectorName(name) {
    return name.replace(/^value/, '');
}

function getColor(index, alpha = 1) {
    const base = '#00ff88';
    const op = 0.6 + (index % 3) * 0.13;
    return `rgba(0, 255, 136, ${Math.min(op, 1)})`;
}

// ---- Render date range ----
function renderDateRange() {
    if (!DATA || !DATA.global.date_range) return;
    const { start, end } = DATA.global.date_range;
    if (dateRangeEl) {
        dateRangeEl.textContent = `📅 ${start} – ${end}`;
    }
}

// ---- Fetch data ----
async function loadData() {
    try {
        const response = await fetch('https://insights.bpoautoaccept.com/get_data.php');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const jsonData = await response.json();
        DATA = jsonData;
        const now = new Date();
        const dateStr = now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        lastUpdated.textContent = `updated ${dateStr}`;
        renderDateRange();
        renderSidebar();
        switchView(currentView);
    } catch (error) {
        console.error('Failed to load data:', error);
        lastUpdated.textContent = '⚠️ update failed';
    }
}

function startAutoRefresh(seconds = 60) {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadData, seconds * 1000);
}

// ---- Sidebar ----
function renderSidebar() {
    if (!DATA) return;
    let html = '';
    const overallActive = (currentView === 'overall') ? 'active' : '';
    html += `
        <div class="client-item ${overallActive}" data-target="overall">
            <span class="client-rank">●</span>
            <span class="client-name">overall</span>
            <span class="client-orders">${DATA.global.total_orders}</span>
        </div>
    `;
    DATA.leaderboard.forEach(item => {
        const active = (currentView === item.inspector) ? 'active' : '';
        html += `
            <div class="client-item ${active}" data-target="${item.inspector}">
                <span class="client-rank">${item.rank}</span>
                <span class="client-name">${cleanInspectorName(item.inspector)}</span>
                <span class="client-orders">${item.total_orders}</span>
            </div>
        `;
    });
    inspectorList.innerHTML = html;
    if (totalOrdersFooter) totalOrdersFooter.textContent = DATA.global.total_orders;
}

// ---- Switch view ----
function switchView(target) {
    document.querySelectorAll('.client-item').forEach(el => el.classList.remove('active'));
    const targetEl = document.querySelector(`.client-item[data-target="${target}"]`);
    if (targetEl) targetEl.classList.add('active');
    currentView = target;
    if (target === 'overall') renderOverall();
    else renderInspector(target);
}

// ---- Chart title updates ----
function updateChartTitles(isOverall) {
    if (isOverall) {
        stateChartTitle.textContent   = 'top states';
        itemChartTitle.textContent    = 'monthly trend';
        monthlyChartTitle.textContent = 'orders per month';
    } else {
        stateChartTitle.textContent   = 'state distribution';
        itemChartTitle.textContent    = 'monthly orders';
        monthlyChartTitle.textContent = 'monthly trend';
    }
}

// ---- Render KPIs ----
function renderKPIs(kpiArray) {
    let html = '';
    kpiArray.forEach(k => {
        html += `
            <div class="metric-item">
                <div class="metric-label">${k.label}</div>
                <div class="metric-value">${k.value}</div>
            </div>
        `;
    });
    kpiGrid.innerHTML = html;
}

// ---- Render charts ----
function renderChart(canvasId, type, labels, data, label) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (charts[canvasId]) charts[canvasId].destroy();
    const colors = labels.map((_, i) => getColor(i, 0.7));
    const borderColors = labels.map((_, i) => getColor(i, 1));
    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: type === 'line' ? 'rgba(0, 255, 136, 0.15)' : colors,
                borderColor: type === 'line' ? '#00ff88' : borderColors,
                borderWidth: type === 'line' ? 1.5 : 0,
                pointBackgroundColor: '#00ff88',
                pointRadius: type === 'line' ? 2 : 0,
                tension: 0.3,
                fill: type === 'line' ? true : false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#b0c4d0', precision: 0 },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    ticks: { color: '#b0c4d0' },
                    grid: { color: 'rgba(255,255,255,0.03)' }
                }
            }
        }
    });
}

// ---- Render table ----
function renderTable(headers, rows) {
    const thead = document.querySelector('#data-table thead');
    const tbody = document.getElementById('table-body');
    let headerHtml = '<tr>';
    headers.forEach(h => headerHtml += `<th>${h}</th>`);
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;
    let bodyHtml = '';
    rows.forEach(row => {
        bodyHtml += '<tr>';
        row.forEach(cell => bodyHtml += `<td>${cell}</td>`);
        bodyHtml += '</tr>';
    });
    tbody.innerHTML = bodyHtml;
}

// ---- Overall view ----
function renderOverall() {
    if (!DATA) return;
    const g = DATA.global;
    pageTitle.textContent = 'overall';
    updateChartTitles(true);
    const kpis = [
        { label: 'Total Orders', value: g.total_orders },
        { label: 'Avg / Day', value: round(g.avg_per_day) },
        { label: 'Avg / Week', value: round(g.avg_per_week) },
        { label: 'Avg / Month', value: round(g.avg_per_month) },
        { label: 'Avg / Year', value: round(g.avg_per_year) },
        { label: 'Email Rate', value: g.email_success_rate_global + '%' },
        { label: 'Inspectors', value: Object.keys(DATA.per_inspector).length },
    ];
    renderKPIs(kpis);
    renderChart('stateChart', 'bar', Object.keys(g.top_states), Object.values(g.top_states), 'Orders');
    const monthKeys = Object.keys(g.monthly_trend);
    const monthVals = Object.values(g.monthly_trend);
    renderChart('itemChart', 'bar', monthKeys, monthVals, 'Orders');
    renderChart('monthlyChart', 'line', monthKeys, monthVals, 'Orders');
    tableTitle.textContent = 'leaderboard';
    const headers = ['Rank', 'Inspector', 'Total Orders', 'Email Rate', 'Avg / Day'];
    const rows = DATA.leaderboard.map(item => [
        item.rank,
        cleanInspectorName(item.inspector),
        item.total_orders,
        round(item.email_success_rate) + '%',
        round(item.avg_per_day)
    ]);
    renderTable(headers, rows);
}

// ---- Inspector view ----
function renderInspector(name) {
    if (!DATA) return;
    const data = DATA.per_inspector[name];
    if (!data) return;
    pageTitle.textContent = cleanInspectorName(name);
    updateChartTitles(false);
    const kpis = [
        { label: 'Total Orders', value: data.total_orders },
        { label: 'Avg / Day', value: round(data.avg_per_day) },
        { label: 'Avg / Week', value: round(data.avg_per_week) },
        { label: 'Avg / Month', value: round(data.avg_per_month) },
        { label: 'Avg / Year', value: round(data.avg_per_year) },
        { label: 'Email Rate', value: data.email_success_rate + '%' },
        { label: 'Top State', value: data.top_state || '—' },
        { label: 'Days Active', value: data.date_range_days || '—' },
    ];
    renderKPIs(kpis);
    const stateKeys = Object.keys(data.state_counts);
    const stateVals = Object.values(data.state_counts);
    renderChart('stateChart', 'bar', stateKeys, stateVals, 'Orders');
    const months = Object.keys(data.orders_per_month).sort();
    const monthVals = months.map(m => data.orders_per_month[m]);
    renderChart('itemChart', 'bar', months, monthVals, 'Orders');
    renderChart('monthlyChart', 'line', months, monthVals, 'Orders');
    tableTitle.textContent = 'monthly orders';
    const headers = ['Month', 'Orders'];
    const rows = months.map(m => [m, data.orders_per_month[m]]);
    renderTable(headers, rows);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', function() {
    const list = document.querySelector('.client-list');
    if (list) {
        list.addEventListener('click', function(e) {
            const item = e.target.closest('.client-item');
            if (!item) return;
            const target = item.dataset.target;
            if (target) switchView(target);
        });
    } else {
        console.error('Sidebar container not found');
    }
    loadData();
    startAutoRefresh(60);
});
