const API_BASE = '/api';
let allReturnsData = [];
let availablePeriods = [];
let currentConfig = {
    reportPeriods: [],
    useCompositeScore: false,
    mvWeight: 0.5,
    dvWeight: 0.3,
    qualityWeight: 0.2,
    qualityFactorType: 'pe_pb'
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializePage();
    } catch (error) {
        showError(error.message);
    }
});

async function initializePage() {
    showLoading(true);

    try {
        // 获取基金信息
        const fundInfo = await fetchFundInfo();
        displayFundInfo(fundInfo);

        // 获取所有报告期
        availablePeriods = await fetchReportPeriods();
        setupConfigPanel();
        
        // 不自动加载数据，等待用户点击"应用配置并计算"
        showLoading(false);
        
        // 显示提示信息
        document.getElementById('chartsSection').style.display = 'block';
        document.getElementById('holdingsTable').style.display = 'block';
        showPlaceholder();
        
    } catch (error) {
        showLoading(false);
        throw error;
    }
}

function showPlaceholder() {
    const chartCanvas = document.getElementById('cumulativeReturnChart');
    const ctx = chartCanvas.getContext('2d');
    
    // 清空画布
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    
    // 显示提示文字
    ctx.font = '20px Arial';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('请配置策略参数后点击"应用配置并计算"按钮', chartCanvas.width / 2, chartCanvas.height / 2);
    
    // 清空持仓表格
    document.getElementById('originalHoldingsTable').innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #999;">等待计算...</td></tr>';
    document.getElementById('adjustedHoldingsTable').innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">等待计算...</td></tr>';
}

async function loadData() {
    showLoading(true);

    try {
        const returnsResult = await fetchAllReturns(currentConfig);
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

async function fetchReportPeriods() {
    const response = await fetch(`${API_BASE}/report-periods`);
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || '获取报告期失败');
    }
    
    return result.data;
}

async function fetchAllReturns(config) {
    const params = new URLSearchParams();
    
    if (config.reportPeriods && config.reportPeriods.length > 0) {
        params.append('reportPeriods', config.reportPeriods.join(','));
    }
    
    params.append('useCompositeScore', config.useCompositeScore);
    params.append('mvWeight', config.mvWeight);
    params.append('dvWeight', config.dvWeight);
    params.append('qualityWeight', config.qualityWeight);
    params.append('qualityFactorType', config.qualityFactorType);
    
    const response = await fetch(`${API_BASE}/all-returns?${params}`);
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

function setupConfigPanel() {
    // 显示配置面板
    document.getElementById('configPanel').style.display = 'block';
    
    // 填充报告期选择框
    const periodCheckboxes = document.getElementById('periodCheckboxes');
    periodCheckboxes.innerHTML = '';
    
    availablePeriods.forEach(period => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="period-checkbox" value="${period}"> ${formatDate(period)}`;
        periodCheckboxes.appendChild(label);
    });
    
    // 全选/取消全选
    document.getElementById('selectAllPeriods').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.period-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });
    
    // 策略类型切换
    document.querySelectorAll('input[name="strategy"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const compositeWeights = document.getElementById('compositeWeights');
            compositeWeights.style.display = e.target.value === 'composite' ? 'block' : 'none';
        });
    });
    
    // 质量因子选择
    document.querySelectorAll('input[name="qualityFactor"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateFactorDescription(e.target.value);
        });
    });
    
    // 权重滑块
    ['mvWeight', 'dvWeight', 'qualityWeight'].forEach(id => {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(id + 'Value');
        
        slider.addEventListener('input', (e) => {
            valueSpan.textContent = parseFloat(e.target.value).toFixed(2);
            updateWeightSum();
        });
    });
    
    // 应用配置按钮
    document.getElementById('applyConfig').addEventListener('click', applyConfiguration);
    
    // 重置按钮
    document.getElementById('resetConfig').addEventListener('click', resetConfiguration);
}

function updateFactorDescription(factorType) {
    const descriptions = {
        'pe_pb': '💡 PE+PB综合：质量因子 = (1/PE + 1/PB) / 2，值越大质量越好',
        'pe': '💡 仅市盈率PE：质量因子 = 1/PE，PE越低质量越好',
        'pb': '💡 仅市净率PB：质量因子 = 1/PB，PB越低质量越好',
        'roe': '💡 ROE（净资产收益率）：ROE越高质量越好，反映盈利能力'
    };
    document.getElementById('factorDescription').textContent = descriptions[factorType] || descriptions['pe_pb'];
}

function updateWeightSum() {
    const mvWeight = parseFloat(document.getElementById('mvWeight').value);
    const dvWeight = parseFloat(document.getElementById('dvWeight').value);
    const qualityWeight = parseFloat(document.getElementById('qualityWeight').value);
    const sum = mvWeight + dvWeight + qualityWeight;
    
    document.getElementById('weightSum').textContent = sum.toFixed(2);
    
    const warning = document.getElementById('weightWarning');
    if (Math.abs(sum - 1.0) > 0.01) {
        warning.style.display = 'inline';
    } else {
        warning.style.display = 'none';
    }
}

async function applyConfiguration() {
    // 获取选中的报告期
    const selectAll = document.getElementById('selectAllPeriods').checked;
    let selectedPeriods = [];
    
    if (!selectAll) {
        const checkboxes = document.querySelectorAll('.period-checkbox:checked');
        selectedPeriods = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedPeriods.length === 0) {
            alert('请至少选择一个报告期');
            return;
        }
    }
    
    // 获取策略类型
    const strategy = document.querySelector('input[name="strategy"]:checked').value;
    const useCompositeScore = strategy === 'composite';
    
    // 获取质量因子类型
    const qualityFactorType = document.querySelector('input[name="qualityFactor"]:checked')?.value || 'pe_pb';
    
    // 获取权重
    const mvWeight = parseFloat(document.getElementById('mvWeight').value);
    const dvWeight = parseFloat(document.getElementById('dvWeight').value);
    const qualityWeight = parseFloat(document.getElementById('qualityWeight').value);
    
    // 验证权重和
    if (useCompositeScore && Math.abs(mvWeight + dvWeight + qualityWeight - 1.0) > 0.01) {
        alert('权重总和必须为1.0');
        return;
    }
    
    // 更新配置
    currentConfig = {
        reportPeriods: selectedPeriods,
        useCompositeScore,
        mvWeight,
        dvWeight,
        qualityWeight,
        qualityFactorType
    };
    
    // 重新加载数据
    await loadData();
}

function resetConfiguration() {
    document.getElementById('selectAllPeriods').checked = true;
    document.querySelectorAll('.period-checkbox').forEach(cb => cb.checked = false);
    document.querySelector('input[name=\"strategy\"][value=\"marketValue\"]').checked = true;
    document.getElementById('compositeWeights').style.display = 'none';
    document.getElementById('mvWeight').value = 0.5;
    document.getElementById('dvWeight').value = 0.3;
    document.getElementById('qualityWeight').value = 0.2;
    document.getElementById('mvWeightValue').textContent = '0.50';
    document.getElementById('dvWeightValue').textContent = '0.30';
    document.getElementById('qualityWeightValue').textContent = '0.20';
    updateWeightSum();
}

/**
 * 显示持仓明细表格
 */
function displayHoldingsTable(data) {
    if (data.length === 0) return;
    
    // 填充报告期选择下拉框
    const periodSelect = document.getElementById('holdingsPeriodSelect');
    periodSelect.innerHTML = '';
    data.forEach((period, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = formatDate(period.reportDate);
        periodSelect.appendChild(option);
    });
    
    // 监听报告期切换
    periodSelect.onchange = (e) => {
        const selectedIndex = parseInt(e.target.value);
        renderHoldingsForPeriod(data[selectedIndex]);
    };
    
    // 默认显示第一个报告期
    renderHoldingsForPeriod(data[0]);
    
    document.getElementById('holdingsTable').style.display = 'block';
}

function renderHoldingsForPeriod(period) {
    if (!period || !period.adjustedHoldings) return;
    
    // 更新标题
    const reportDateFormatted = formatDate(period.reportDate);
    document.getElementById('originalHoldingsTitle').textContent = `基金持仓 (${reportDateFormatted})`;
    
    const strategyTitle = document.getElementById('strategyTitle');
    if (currentConfig.useCompositeScore) {
        strategyTitle.textContent = `策略持仓（综合得分+10%上限） (${reportDateFormatted})`;
    } else {
        strategyTitle.textContent = `策略持仓（市值加权+10%上限） (${reportDateFormatted})`;
    }
    
    // 显示/隐藏综合得分列
    const compositeCols = document.querySelectorAll('.composite-col');
    compositeCols.forEach(col => {
        col.style.display = currentConfig.useCompositeScore ? 'table-cell' : 'none';
    });
    
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
        
        let rowHtml = `
            <td>${index + 1}</td>
            <td>${stock.symbol}</td>
            <td>${stock.name || stock.symbol}</td>
            <td>${(stock.adjustedWeight * 100).toFixed(2)}%</td>
        `;
        
        if (currentConfig.useCompositeScore) {
            rowHtml += `
                <td class="composite-col">${(stock.compositeScore || 0).toFixed(4)}</td>
                <td class="composite-col">${(stock.dvRatio || 0).toFixed(2)}%</td>
                <td class="composite-col">${(stock.qualityFactor || 0).toFixed(4)}</td>
            `;
        }
        
        rowHtml += `<td style="${statusColor}">${statusText}</td>`;
        
        tr.innerHTML = rowHtml;
        adjustedBody.appendChild(tr);
    });
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
