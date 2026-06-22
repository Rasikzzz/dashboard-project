// ============================================================
//  CLIENT DASHBOARD – live data from cPanel backend
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

    const globalDiv = document.getElementById('global');
    const leaderboardTbody = document.getElementById('leaderboard');

    if (!globalDiv || !leaderboardTbody) {
        console.error('Required DOM elements not found.');
        return;
    }

    async function loadData() {
        try {
            console.log('Fetching data...');
            const response = await fetch('https://insights.bpoautoaccept.com/get_data.php');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            console.log('Data received', data);
            renderGlobal(data.global);
            renderLeaderboard(data.leaderboard);
        } catch (error) {
            console.error('Error loading data:', error);
            globalDiv.innerHTML = '<p style="color:red;">Failed to load data</p>';
        }
    }

    function renderGlobal(global) {
        globalDiv.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-item"><span class="kpi-label">Total Orders</span><span class="kpi-value">${global.total_orders}</span></div>
                <div class="kpi-item"><span class="kpi-label">Avg / Day</span><span class="kpi-value">${global.avg_per_day.toFixed(2)}</span></div>
                <div class="kpi-item"><span class="kpi-label">Avg / Week</span><span class="kpi-value">${global.avg_per_week.toFixed(2)}</span></div>
                <div class="kpi-item"><span class="kpi-label">Avg / Month</span><span class="kpi-value">${global.avg_per_month.toFixed(2)}</span></div>
                <div class="kpi-item"><span class="kpi-label">Email Success</span><span class="kpi-value">${global.email_success_rate_global.toFixed(1)}%</span></div>
                <div class="kpi-item"><span class="kpi-label">Inspectors</span><span class="kpi-value">${Object.keys(global.top_states).length}</span></div>
            </div>
            <div style="margin-top:16px;"><strong>Top States:</strong> ${Object.entries(global.top_states).map(([s,c]) => `${s} (${c})`).join(' · ')}</div>
        `;
    }

    function renderLeaderboard(leaderboard) {
        if (!leaderboard || leaderboard.length === 0) {
            leaderboardTbody.innerHTML = '<tr><td colspan="4">No data</td></tr>';
            return;
        }
        leaderboardTbody.innerHTML = leaderboard.map(item => `
            <tr>
                <td>${item.rank}</td>
                <td>${item.inspector}</td>
                <td>${item.total_orders}</td>
                <td>${item.email_success_rate.toFixed(1)}%</td>
            </tr>
        `).join('');
    }

    // Load immediately and every 60 seconds
    loadData();
    setInterval(loadData, 60000);
});
