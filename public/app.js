const API_BASE = '/api';
let allReturnsData = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
    } catch (error) {
        showError(error.message);
    }
});

async function loadData() {
    showLoading(true);

    try {
        const fundInfo = await fetchFundInfo();
        displayFundInfo(fundInfo);

        const returnsResult = await fetchAllReturns();
        allReturnsData = returnsResult.adjustedReturns;
        
        console.log('获取到的数据:', allReturnsData);
        console.log('数据条数:', allReturnsData.length);
        
        if (!allReturnsData || allReturnsData.length === 0) {
            throw new Error('未获取到收益率数据');
        }

        // 绘制收益对比曲线
        drawCumulativeReturnChart(allReturnsData);
        document.getElementById('chartsSection').style.display = 'block';

        // 显示持仓明细
        displayHoldingsTable(allReturnsData);

        showLoading(false);
    } catch (error) {
        showLoading(false);
        throw error;
    }
}

async function fetchFundInfo() {
    const response = await fetch(`${API_BASE}/fund-info`);
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || '获取基金信息失败');
    }
    
    return result.data;
}

async function fetchAllReturns() {
    const response = await fetch(`${API_BASE}/all-returns`);
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || '获取收益率数据失败');
    }
    
    return result.data;
}

function displayFundInfo(info) {
    if (!info) return;

    document.getElementById('fundCode').textContent = info.ts_code || '-';
    document.getElementById('fundName').textContent = info.name || '-';
    document.getElementById('fundManager').textContent = info.management || '-';
    document.getElementById('foundDate').textContent = formatDate(info.found_date) || '-';

    document.getElementById('fundInfo').style.display = 'block';
}

/**
 * 显示持仓明细表格
 */
function displayHoldingsTable(data) {
    if (data.length === 0) return;
    
    const period = data[0];  // 只有一个报告期
    if (!period || !period.adjustedHoldings) return;
    
    // 填充原始持仓表格（按基金权重排序）
    const originalBody = document.getElementById('originalHoldingsTable');
    originalBody.innerHTML = '';
    const sortedByOriginal = [...period.adjustedHoldings].sort((a, b) => b.originalWeight - a.originalWeight);
    sortedByOriginal.forEach((stock, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${stock.symbol}</td>
            <td>${stock.name || stock.symbol}</td>
            <td>${(stock.originalWeight * 100).toFixed(2)}%</td>
        `;
        originalBody.appendChild(tr);
    });
    
    // 填充策略持仓表格（按策略权重排序）
    const adjustedBody = document.getElementById('adjustedHoldingsTable');
    adjustedBody.innerHTML = '';
    const sortedByAdjusted = [...period.adjustedHoldings].sort((a, b) => b.adjustedWeight - a.adjustedWeight);
    sortedByAdjusted.forEach((stock, index) => {
        const tr = document.createElement('tr');
        const statusText = stock.isLimited ? '⚠️ 受限10%' : '✓';
        const statusColor = stock.isLimited ? 'color: #FF6B6B; font-weight: bold;' : 'color: #06D6A0;';
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${stock.symbol}</td>
            <td>${stock.name || stock.symbol}</td>
            <td>${(stock.adjustedWeight * 100).toFixed(2)}%</td>
            <td style="${statusColor}">${statusText}</td>
        `;
        adjustedBody.appendChild(tr);
    });
    
    document.getElementById('holdingsTable').style.display = 'block';
}

function drawCumulativeReturnChart(data) {
    const ctx = document.getElementById('cumulativeReturnChart').getContext('2d');
    
    // 构建数据点：起点(0,0) + 实际数据点
    const labels = ['起始', ...data.map(d => formatDate(d.endDate))];
    const replicatedData = [0, ...data.map(d => (d.adjustedCumulativeReturn || d.adjustedReturn) * 100)];
    const fundData = [0, ...data.map(d => (d.fundCumulativeReturn || d.fundReturn) * 100)];
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '复制组合',
                    data: replicatedData,
                    borderColor: '#2E86AB',
                    backgroundColor: 'rgba(46, 134, 171, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '原512890基金',
                    data: fundData,
                    borderColor: '#A23B72',
                    backgroundColor: 'rgba(162, 59, 114, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: { callback: (value) => value + '%' }
                }
            }
        }
    });
}


function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('error').style.display = 'block';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const str = String(dateStr);
    return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
}

function formatPercent(value) {
    if (value === null || value === undefined) return '-';
    const percent = (value * 100).toFixed(2);
    return `${percent >= 0 ? '+' : ''}${percent}%`;
}
