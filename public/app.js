const API_BASE = '/api';
let allReturnsData = [];
let chartInstance = null;  // 保存图表实例，用于销毁和重建
let currentConfig = {
    startDate: '',  // 开始日期，留空则使用指数最早的调仓日
    endDate: '',    // 结束日期，留空则使用指数最新的调仓日
    useCompositeScore: false,
    mvWeight: 0.5,
    dvWeight: 0.3,
    qualityWeight: 0.2,
    qualityFactorType: 'pe_pb',
    maxWeight: 0.10  // 单只股票最大权重，默认10%
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
        // 设置默认日期
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) startDateInput.value = '2018-11-30';
        if (endDateInput) endDateInput.value = todayStr;
        
        // 获取基金信息
        const fundInfo = await fetchFundInfo();
        displayFundInfo(fundInfo);

        // 设置配置面板
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
    const indexTable = document.getElementById('indexHoldingsTable');
    const adjustedTable = document.getElementById('adjustedHoldingsTable');
    
    if (indexTable) indexTable.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #999;">等待计算...</td></tr>';
    if (adjustedTable) adjustedTable.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">等待计算...</td></tr>';
}

async function loadData() {
    showLoading(true);

    try {
        const returnsResult = await fetchAllReturns(currentConfig);
        allReturnsData = returnsResult.periods;
        const customRisk = returnsResult.customRisk;
        const indexRisk = returnsResult.indexRisk;
        const trackingError = returnsResult.trackingError;
        
        console.log('获取到的数据:', allReturnsData);
        console.log('数据条数:', allReturnsData.length);
        console.log('自定义策略风险指标:', customRisk);
        console.log('指数风险指标:', indexRisk);
        console.log('跟踪误差:', trackingError);
        
        if (!allReturnsData || allReturnsData.length === 0) {
            throw new Error('未获取到收益率数据');
        }

        // 绘制收益对比曲线
        drawCumulativeReturnChart(allReturnsData, customRisk, indexRisk);
        document.getElementById('chartsSection').style.display = 'block';

        // 显示持仓明细
        displayHoldingsTable(allReturnsData);
        
        // 显示风险指标
        displayRiskMetrics(customRisk, indexRisk, trackingError);

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
    
    // 兼容旧格式和新格式
    if (result.data.periods) {
        return result.data;  // 新格式：包含periodInfo
    } else {
        return { periods: result.data };  // 旧格式：只有periods数组
    }
}

async function fetchAllReturns(config) {
    const params = new URLSearchParams();
    
    // 添加日期范围参数
    if (config.startDate) {
        params.append('startDate', config.startDate);
    }
    if (config.endDate) {
        params.append('endDate', config.endDate);
    }
    
    params.append('useCompositeScore', config.useCompositeScore);
    params.append('mvWeight', config.mvWeight);
    params.append('dvWeight', config.dvWeight);
    params.append('qualityWeight', config.qualityWeight);
    params.append('qualityFactorType', config.qualityFactorType);
    params.append('maxWeight', config.maxWeight || 0.10);
    
    const response = await fetch(`${API_BASE}/index-returns?${params}`);
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || '获取收益率数据失败');
    }
    
    return result.data;
}

function displayFundInfo(info) {
    if (!info) return;

    const fundCodeEl = document.getElementById('fundCode');
    const fundNameEl = document.getElementById('fundName');
    const fundManagerEl = document.getElementById('fundManager');
    const foundDateEl = document.getElementById('foundDate');
    const fundInfoEl = document.getElementById('fundInfo');

    if (fundCodeEl) fundCodeEl.textContent = info.ts_code || '-';
    if (fundNameEl) fundNameEl.textContent = info.name || '-';
    if (fundManagerEl) fundManagerEl.textContent = info.management || '-';
    if (foundDateEl) foundDateEl.textContent = formatDate(info.found_date) || '-';
    if (fundInfoEl) fundInfoEl.style.display = 'block';
}

function setupConfigPanel() {
    // 显示配置面板
    const configPanelEl = document.getElementById('configPanel');
    if (configPanelEl) configPanelEl.style.display = 'block';
    
    // 策略类型切换
    document.querySelectorAll('input[name="strategy"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const compositeWeights = document.getElementById('compositeWeights');
            const marketValueConfig = document.getElementById('marketValueConfig');
            if (e.target.value === 'composite') {
                compositeWeights.style.display = 'block';
                marketValueConfig.style.display = 'none';
            } else {
                compositeWeights.style.display = 'none';
                marketValueConfig.style.display = 'block';
            }
        });
    });
    
    // 市值加权策略权重上限滑块
    const mvMaxWeightSlider = document.getElementById('mvMaxWeightSlider');
    const mvMaxWeightValue = document.getElementById('mvMaxWeightValue');
    mvMaxWeightSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        mvMaxWeightValue.textContent = value + '%';
    });
    
    // 综合得分策略权重上限滑块
    const maxWeightSlider = document.getElementById('maxWeightSlider');
    const maxWeightValue = document.getElementById('maxWeightValue');
    maxWeightSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        maxWeightValue.textContent = value + '%';
    });
    
    // 质量因子选择
    document.querySelectorAll('input[name="qualityFactor"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateFactorDescription(e.target.value);
        });
    });
    
    // 权重滑块 - 添加智能调整功能
    ['mvWeight', 'dvWeight', 'qualityWeight'].forEach(id => {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(id + 'Value');
        
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueSpan.textContent = value.toFixed(2);
            
            // 如果某个权重被拉到1.0，自动将其他权重设为0
            if (value >= 0.99) {
                ['mvWeight', 'dvWeight', 'qualityWeight'].forEach(otherId => {
                    if (otherId !== id) {
                        const otherSlider = document.getElementById(otherId);
                        const otherValueSpan = document.getElementById(otherId + 'Value');
                        otherSlider.value = 0;
                        otherValueSpan.textContent = '0.00';
                    }
                });
            }
            
            updateWeightSum();
        });
    });
    
    // 应用配置按钮
    document.getElementById('applyConfig').addEventListener('click', applyConfiguration);
    
    // 重置按钮
    document.getElementById('resetConfig').addEventListener('click', resetConfiguration);
    
    // 指数成分股查询按钮
    document.getElementById('queryConstituents').addEventListener('click', queryIndexConstituents);
    
    // 加载调仓日期列表
    loadRebalanceDates();
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
    // 获取日期范围
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // 验证日期范围
    if (startDate && endDate && startDate > endDate) {
        alert('开始日期不能晚于结束日期');
        return;
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
    
    // 获取权重上限
    let maxWeight;
    if (useCompositeScore) {
        maxWeight = parseInt(document.getElementById('maxWeightSlider').value) / 100;
    } else {
        maxWeight = parseInt(document.getElementById('mvMaxWeightSlider').value) / 100;
    }
    
    // 验证权重和
    if (useCompositeScore && Math.abs(mvWeight + dvWeight + qualityWeight - 1.0) > 0.01) {
        alert('权重总和必须为1.0');
        return;
    }
    
    // 保存配置
    currentConfig = {
        startDate: startDate ? startDate.replace(/-/g, '') : '',  // 转换为YYYYMMDD格式
        endDate: endDate ? endDate.replace(/-/g, '') : '',
        useCompositeScore,
        mvWeight,
        dvWeight,
        qualityWeight,
        qualityFactorType,
        maxWeight
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
    
    // 填充调仓期选择下拉框
    const periodSelect = document.getElementById('holdingsPeriodSelect');
    if (!periodSelect) {
        console.error('找不到holdingsPeriodSelect元素');
        return;
    }
    
    periodSelect.innerHTML = '';
    data.forEach((period, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = formatDate(period.rebalanceDate || period.reportDate);
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
    if (!period || !period.holdings) return;
    
    // 更新标题
    const rebalanceDateFormatted = formatDate(period.rebalanceDate || period.reportDate);
    const titleElement = document.getElementById('originalHoldingsTitle');
    if (titleElement) {
        titleElement.textContent = `h30269.CSI指数持仓 (${rebalanceDateFormatted})`;
    }
    
    // 更新调仓期详细信息
    updatePeriodInfo(period);
    
    // 更新提示信息
    const holdingsNote = document.getElementById('holdingsNote');
    if (holdingsNote) {
        if (currentConfig.useCompositeScore) {
            holdingsNote.innerHTML = '<strong>💡 提示：</strong>左侧为指数持仓，右侧为策略持仓（综合得分策略）。';
        } else {
            holdingsNote.innerHTML = '<strong>💡 提示：</strong>左侧为指数持仓，右侧为策略持仓（市值加权，单只上限10%）。';
        }
    }
    
    const strategyTitle = document.getElementById('strategyTitle');
    if (strategyTitle) {
        if (currentConfig.useCompositeScore) {
            strategyTitle.textContent = `策略持仓（综合得分） (${rebalanceDateFormatted})`;
        } else {
            strategyTitle.textContent = `策略持仓（市值加权+10%上限） (${rebalanceDateFormatted})`;
        }
    }
    
    // 显示/隐藏综合得分列
    const compositeCols = document.querySelectorAll('.composite-col');
    compositeCols.forEach(col => {
        col.style.display = currentConfig.useCompositeScore ? 'table-cell' : 'none';
    });
    
    // 填充指数持仓表格（按指数权重排序）
    const indexBody = document.getElementById('indexHoldingsTable');
    indexBody.innerHTML = '';
    const sortedByIndex = [...period.holdings].sort((a, b) => b.indexWeight - a.indexWeight);
    sortedByIndex.forEach((stock, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${stock.symbol}</td>
            <td>${stock.name || stock.symbol}</td>
            <td>${(stock.indexWeight || 0).toFixed(2)}%</td>
        `;
        indexBody.appendChild(tr);
    });
    
    // 填充策略持仓表格（按策略权重排序）
    const adjustedBody = document.getElementById('adjustedHoldingsTable');
    adjustedBody.innerHTML = '';
    
    // 检查数据是否存在
    if (!period.holdings || period.holdings.length === 0) {
        console.error('策略持仓数据为空:', period);
        adjustedBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #FF6B6B;">⚠️ 策略持仓数据为空，请检查后端返回数据</td></tr>';
        return;
    }
    
    const sortedByAdjusted = [...period.holdings].sort((a, b) => b.customWeight - a.customWeight);
    sortedByAdjusted.forEach((stock, index) => {
        const tr = document.createElement('tr');
        
        let rowHtml = `
            <td>${index + 1}</td>
            <td>${stock.symbol}</td>
            <td>${stock.name || stock.symbol}</td>
            <td>${(stock.customWeight * 100).toFixed(2)}%</td>
        `;
        
        if (currentConfig.useCompositeScore) {
            // 综合得分策略：显示得分相关列，无状态列
            rowHtml += `
                <td class="composite-col">${(parseFloat(stock.compositeScore) || 0).toFixed(4)}</td>
                <td class="composite-col">${(parseFloat(stock.dvRatio) || 0).toFixed(2)}%</td>
                <td class="composite-col">${(parseFloat(stock.qualityFactor) || 0).toFixed(4)}</td>
            `;
        } else {
            // 市值加权策略：显示状态列
            const statusText = stock.isLimited ? '⚠️ 受限10%' : '✓';
            const statusColor = stock.isLimited ? 'color: #FF6B6B; font-weight: bold;' : 'color: #06D6A0;';
            rowHtml += `<td style="${statusColor}">${statusText}</td>`;
        }
        
        tr.innerHTML = rowHtml;
        adjustedBody.appendChild(tr);
    });
}

function drawCumulativeReturnChart(data, customRisk, indexRisk) {
    const ctx = document.getElementById('cumulativeReturnChart').getContext('2d');
    
    // 销毁旧图表实例（如果存在）
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    
    // 调试：查看第一个调仓期的数据
    if (data.length > 0) {
        console.log('第一个调仓期数据:', {
            rebalanceDate: data[0].rebalanceDate,
            customCumulativeReturn: data[0].customCumulativeReturn,
            indexCumulativeReturn: data[0].indexCumulativeReturn,
            trackingError: data[0].trackingError
        });
    }
    
    // 显示累计收益率：自定义策略 vs 原策略
    // 横轴使用披露日期（每个报告期公布持仓的日期）
    // 直接使用每个报告期的披露日期和累计收益率，不添加起始点
    const labels = data.map(d => formatDate(d.rebalanceDate));
    // 注意：不能使用 || 运算符，因为0是falsy值，会导致第一个点显示错误
    const customData = data.map(d => (d.customCumulativeReturn !== undefined ? d.customCumulativeReturn : d.customReturn) * 100);
    const indexData = data.map(d => (d.indexCumulativeReturn !== undefined ? d.indexCumulativeReturn : d.indexReturn) * 100);
    const fundData = data.map(d => (d.fundCumulativeReturn !== undefined ? d.fundCumulativeReturn : d.fundReturn) * 100);
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '自定义策略',
                    data: customData,
                    borderColor: '#2E86AB',
                    backgroundColor: 'rgba(46, 134, 171, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'h30269.CSI指数',
                    data: indexData,
                    borderColor: '#F18F01',
                    backgroundColor: 'rgba(241, 143, 1, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: '512890.SH基金净值',
                    data: fundData,
                    borderColor: '#A23B72',
                    backgroundColor: 'rgba(162, 59, 114, 0.1)',
                    borderWidth: 2,
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
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorMessageEl = document.getElementById('errorMessage');
    const errorEl = document.getElementById('error');
    
    if (errorMessageEl) errorMessageEl.textContent = message;
    if (errorEl) errorEl.style.display = 'block';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr);
    return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
}

function displayRiskMetrics(customRisk, indexRisk, trackingError) {
    if (!customRisk || !indexRisk) return;
    
    const riskSection = document.getElementById('riskMetrics');
    if (!riskSection) return;
    
    riskSection.style.display = 'block';
    
    const customMetrics = document.getElementById('customRiskMetrics');
    const indexMetrics = document.getElementById('indexRiskMetrics');
    
    customMetrics.innerHTML = `
        <div class="risk-item">
            <span class="risk-label">累计收益率:</span>
            <span class="risk-value">${(customRisk.totalReturn * 100).toFixed(2)}%</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">年化收益率:</span>
            <span class="risk-value">${(customRisk.annualizedReturn * 100).toFixed(2)}%</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">年化波动率:</span>
            <span class="risk-value">${(customRisk.volatility * 100).toFixed(2)}%</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">最大回撤:</span>
            <span class="risk-value" style="color: #FF6B6B;">${(customRisk.maxDrawdown * 100).toFixed(2)}%</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">夏普比率:</span>
            <span class="risk-value">${customRisk.sharpeRatio.toFixed(2)}</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">索提诺比率:</span>
            <span class="risk-value">${customRisk.sortinoRatio.toFixed(2)}</span>
        </div>
    `;
    
    indexMetrics.innerHTML = `
        <div class="risk-item">
            <span class="risk-label">年化收益率:</span>
            <span class="risk-value">${(indexRisk.annualizedReturn * 100).toFixed(2)}%</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">年化波动率:</span>
            <span class="risk-value">${(indexRisk.volatility * 100).toFixed(2)}%</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">最大回撤:</span>
            <span class="risk-value" style="color: #FF6B6B;">${(indexRisk.maxDrawdown * 100).toFixed(2)}%</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">夏普比率:</span>
            <span class="risk-value">${indexRisk.sharpeRatio.toFixed(2)}</span>
        </div>
    `;
    
    // 显示跟踪误差
    if (trackingError) {
        const trackingErrorDiv = document.getElementById('trackingErrorMetrics');
        if (trackingErrorDiv) {
            trackingErrorDiv.innerHTML = `
                <div class="risk-item">
                    <span class="risk-label">年化跟踪误差:</span>
                    <span class="risk-value">${(trackingError.trackingError * 100).toFixed(2)}%</span>
                </div>
                <div class="risk-item">
                    <span class="risk-label">平均偏离:</span>
                    <span class="risk-value">${(trackingError.avgDifference * 100).toFixed(2)}%</span>
                </div>
            `;
        }
    }
}

function formatPercent(value) {
    if (value === null || value === undefined) return '-';
    const percent = (value * 100).toFixed(2);
    return `${percent >= 0 ? '+' : ''}${percent}%`;
}

function updatePeriodInfo(period) {
    // 计算指数权重总和
    const totalWeight = period.holdings ? period.holdings.reduce((sum, h) => sum + (h.indexWeight || 0), 0) : 0;
    
    // 更新各个字段（添加null检查）
    const periodDateEl = document.getElementById('periodDate');
    if (periodDateEl) periodDateEl.textContent = formatDate(period.rebalanceDate);
    
    const disclosureDateEl = document.getElementById('disclosureDate');
    if (disclosureDateEl) disclosureDateEl.textContent = period.endDate ? formatDate(period.endDate) : '-';
    
    const holdingStartDateEl = document.getElementById('holdingStartDate');
    if (holdingStartDateEl) holdingStartDateEl.textContent = period.startDate ? formatDate(period.startDate) : '-';
    
    const holdingEndDateEl = document.getElementById('holdingEndDate');
    if (holdingEndDateEl) holdingEndDateEl.textContent = period.endDate ? formatDate(period.endDate) : '-';
    
    const stockCountEl = document.getElementById('stockCount');
    if (stockCountEl) stockCountEl.textContent = `${period.stockCount || (period.holdings ? period.holdings.length : 0)} 只`;
    
    // 期间收益率（持有起始日到持有结束日的单期收益率）
    const customReturn = formatPercent(period.customReturn);
    const indexReturn = formatPercent(period.indexReturn);
    const periodReturnEl = document.getElementById('periodReturn');
    if (periodReturnEl) periodReturnEl.innerHTML = `自定义策略: <strong>${customReturn}</strong> | 指数: <strong>${indexReturn}</strong>`;
    
    const totalWeightEl = document.getElementById('totalWeight');
    if (totalWeightEl) {
        const weight = parseFloat(totalWeight) || 0;
        totalWeightEl.textContent = `${weight.toFixed(2)}%`;
    }
    
    // 跟踪误差
    const trackingError = period.trackingError ? formatPercent(period.trackingError) : '-';
    const trackingErrorEl = document.getElementById('trackingErrorValue');
    if (trackingErrorEl) trackingErrorEl.textContent = trackingError;
    
    // 指数策略按实际调仓日期调仓，无需判断是否调仓
    const rebalanceStatusEl = document.getElementById('rebalanceStatus');
    if (rebalanceStatusEl) rebalanceStatusEl.innerHTML = '<span style="color: #06D6A0; font-weight: 600;">✅ 是（按指数调仓日期）</span>';
}

// 加载调仓日期列表
async function loadRebalanceDates() {
    try {
        const response = await fetch(`${API_BASE}/rebalance-dates`);
        const result = await response.json();
        
        if (!result.success || !result.data || result.data.length === 0) {
            return;
        }
        
        const select = document.getElementById('queryDate');
        if (!select) return;
        
        // 清空并填充选项
        select.innerHTML = '<option value="">请选择调仓日期...</option>';
        
        // 按日期降序排列（最新的在前）
        const dates = result.data.sort((a, b) => b.localeCompare(a));
        
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = formatDate(date);
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('加载调仓日期失败:', error);
    }
}

// 查询指数成分股
async function queryIndexConstituents() {
    const queryDateEl = document.getElementById('queryDate');
    if (!queryDateEl) {
        console.error('找不到queryDate元素');
        return;
    }
    
    const queryDate = queryDateEl.value;
    
    if (!queryDate) {
        alert('请选择调仓日期');
        return;
    }
    
    // 显示加载状态（添加null检查）
    const loadingEl = document.getElementById('constituentsLoading');
    const resultEl = document.getElementById('constituentsResult');
    const errorEl = document.getElementById('constituentsError');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (resultEl) resultEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/index-constituents?date=${queryDate}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || '查询失败');
        }
        
        // 显示结果
        displayConstituents(result.data);
        
    } catch (error) {
        const loadingEl = document.getElementById('constituentsLoading');
        const errorEl = document.getElementById('constituentsError');
        const errorMsg = document.getElementById('constituentsErrorMessage');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'block';
        if (errorMsg) errorMsg.textContent = error.message;
    }
}

function displayConstituents(data) {
    const loadingEl = document.getElementById('constituentsLoading');
    const resultEl = document.getElementById('constituentsResult');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'block';
    
    // 更新统计信息（添加null检查和类型转换）
    const resultDateEl = document.getElementById('resultDate');
    if (resultDateEl) resultDateEl.textContent = formatDate(data.date);
    
    const resultCountEl = document.getElementById('resultCount');
    if (resultCountEl) resultCountEl.textContent = `${data.count || 0} 只`;
    
    const resultTotalWeightEl = document.getElementById('resultTotalWeight');
    if (resultTotalWeightEl) {
        const totalWeight = parseFloat(data.totalWeight) || 0;
        resultTotalWeightEl.textContent = `${totalWeight.toFixed(2)}%`;
    }
    
    // 填充表格
    const tbody = document.getElementById('constituentsTableBody');
    if (!tbody) {
        console.error('找不到constituentsTableBody元素');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!data.constituents || data.constituents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">暂无数据</td></tr>';
        return;
    }
    
    data.constituents.forEach((stock, index) => {
        const tr = document.createElement('tr');
        const weight = parseFloat(stock.weight) || 0;
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${stock.con_code || '-'}</td>
            <td>${stock.name || '-'}</td>
            <td>${weight.toFixed(2)}%</td>
        `;
        tbody.appendChild(tr);
    });
}
