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
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) startDateInput.value = '2020-07-10';
        if (endDateInput) endDateInput.value = '2025-07-10';
        
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

        // 绘制收益对比曲线（传递每日数据）
        const dailyData = returnsResult.dailyData || null;
        console.log('每日数据:', dailyData);
        drawCumulativeReturnChart(allReturnsData, customRisk, indexRisk, dailyData);
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
    const params = new URLSearchParams({
        startDate: config.startDate ? config.startDate.replace(/-/g, '') : '',
        endDate: config.endDate ? config.endDate.replace(/-/g, '') : '',
        maxWeight: config.maxWeight
    });
    
    // 根据策略类型添加不同的参数
    if (config.useRiskParity) {
        // 风险平价策略参数
        params.append('strategyType', 'riskParity');
        params.append('useAdaptive', 'true');  // 启用自适应策略
        if (config.riskParityParams) {
            params.append('volatilityWindow', config.riskParityParams.volatilityWindow);
            params.append('ewmaDecay', config.riskParityParams.ewmaDecay);
            params.append('rebalanceFrequency', config.riskParityParams.rebalanceFrequency);
            params.append('enableTradingCost', config.riskParityParams.enableTradingCost);
            params.append('tradingCostRate', config.riskParityParams.tradingCostRate);
            params.append('riskFreeRate', config.riskParityParams.riskFreeRate || 0.02);
            // 综合优化参数
            params.append('useQualityTilt', config.riskParityParams.useQualityTilt);
            params.append('useCovariance', config.riskParityParams.useCovariance);
            params.append('hybridRatio', config.riskParityParams.hybridRatio);
            // 股票池筛选参数
            params.append('enableStockFilter', config.riskParityParams.enableStockFilter);
            if (config.riskParityParams.stockFilterParams) {
                params.append('minROE', config.riskParityParams.stockFilterParams.minROE);
                params.append('maxDebtRatio', config.riskParityParams.stockFilterParams.maxDebtRatio);
                params.append('momentumMonths', config.riskParityParams.stockFilterParams.momentumMonths);
                params.append('minMomentumReturn', config.riskParityParams.stockFilterParams.minMomentumReturn);
                params.append('filterByQuality', config.riskParityParams.stockFilterParams.filterByQuality);
            }
        }
    } else if (config.useCompositeScore) {
        // 综合得分策略参数
        params.append('strategyType', 'composite');
        params.append('mvWeight', config.mvWeight);
        params.append('dvWeight', config.dvWeight);
        params.append('qualityWeight', config.qualityWeight);
        params.append('qualityFactorType', config.qualityFactorType);
    } else {
        // 市值加权策略参数
        params.append('strategyType', 'marketValue');
    }

    const response = await fetch(`${API_BASE}/index-returns?${params}`);
    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || '获取收益率数据失败');
    }

    return result.data;
}

async function fetchRebalanceChanges() {
    const response = await fetch(`${API_BASE}/rebalance-changes`);
    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || '获取调仓变化数据失败');
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
            updateStrategyDisplay(e.target.value);
        });
    });
    
    // 初始化显示正确的策略配置区域
    const selectedStrategy = document.querySelector('input[name="strategy"]:checked')?.value || 'riskParity';
    updateStrategyDisplay(selectedStrategy);
    
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
    
    // 风险平价策略控件
    const volatilityWindowSlider = document.getElementById('volatilityWindowSlider');
    const volatilityWindowValue = document.getElementById('volatilityWindowValue');
    if (volatilityWindowSlider) {
        volatilityWindowSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            volatilityWindowValue.textContent = value + '个月';
        });
    }
    
    const ewmaDecaySlider = document.getElementById('ewmaDecaySlider');
    const ewmaDecayValue = document.getElementById('ewmaDecayValue');
    if (ewmaDecaySlider) {
        ewmaDecaySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) / 100;
            ewmaDecayValue.textContent = value.toFixed(2);
        });
    }
    
    const enableTradingCost = document.getElementById('enableTradingCost');
    const tradingCostConfig = document.getElementById('tradingCostConfig');
    if (enableTradingCost) {
        enableTradingCost.addEventListener('change', (e) => {
            tradingCostConfig.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    const tradingCostSlider = document.getElementById('tradingCostSlider');
    const tradingCostValue = document.getElementById('tradingCostValue');
    if (tradingCostSlider) {
        tradingCostSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) / 100;
            tradingCostValue.textContent = value.toFixed(2) + '%';
        });
    }
    
    const rpMaxWeightSlider = document.getElementById('rpMaxWeightSlider');
    const rpMaxWeightValue = document.getElementById('rpMaxWeightValue');
    if (rpMaxWeightSlider) {
        rpMaxWeightSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            rpMaxWeightValue.textContent = value + '%';
        });
    }
    
    // 综合优化方案控件
    const hybridRatioSlider = document.getElementById('hybridRatioSlider');
    const hybridRatioValue = document.getElementById('hybridRatioValue');
    if (hybridRatioSlider) {
        hybridRatioSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            hybridRatioValue.textContent = value + '%';
        });
    }
    
    // 股票池筛选控件
    const enableStockFilter = document.getElementById('enableStockFilter');
    const stockFilterConfig = document.getElementById('stockFilterConfig');
    if (enableStockFilter) {
        // 默认显示配置面板（因为默认勾选）
        stockFilterConfig.style.display = enableStockFilter.checked ? 'block' : 'none';
        
        enableStockFilter.addEventListener('change', (e) => {
            stockFilterConfig.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    // ROE筛选复选框
    const enableROEFilter = document.getElementById('enableROEFilter');
    const roeFilterConfig = document.getElementById('roeFilterConfig');
    if (enableROEFilter) {
        enableROEFilter.addEventListener('change', (e) => {
            roeFilterConfig.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    // 负债率筛选复选框
    const enableDebtFilter = document.getElementById('enableDebtFilter');
    const debtFilterConfig = document.getElementById('debtFilterConfig');
    if (enableDebtFilter) {
        enableDebtFilter.addEventListener('change', (e) => {
            debtFilterConfig.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    // 无风险收益率输入框不需要事件处理，直接读取值即可
    
    // 应用配置按钮
    document.getElementById('applyConfig').addEventListener('click', applyConfiguration);
    
    // 重置按钮
    document.getElementById('resetConfig').addEventListener('click', resetConfiguration);
    
    // 指数成分股查询按钮
    document.getElementById('queryConstituents').addEventListener('click', queryIndexConstituents);
    
    // 加载调仓日期列表
    loadRebalanceDates();
}

function updateStrategyDisplay(strategy) {
    const compositeWeights = document.getElementById('compositeWeights');
    const marketValueConfig = document.getElementById('marketValueConfig');
    const riskParityConfig = document.getElementById('riskParityConfig');
    
    if (strategy === 'composite') {
        compositeWeights.style.display = 'block';
        marketValueConfig.style.display = 'none';
        riskParityConfig.style.display = 'none';
    } else if (strategy === 'riskParity') {
        compositeWeights.style.display = 'none';
        marketValueConfig.style.display = 'none';
        riskParityConfig.style.display = 'block';
    } else {
        compositeWeights.style.display = 'none';
        marketValueConfig.style.display = 'block';
        riskParityConfig.style.display = 'none';
    }
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
    const useRiskParity = strategy === 'riskParity';
    
    // 获取质量因子类型
    const qualityFactorType = document.querySelector('input[name="qualityFactor"]:checked')?.value || 'pe_pb';
    
    // 获取权重
    const mvWeight = parseFloat(document.getElementById('mvWeight').value);
    const dvWeight = parseFloat(document.getElementById('dvWeight').value);
    const qualityWeight = parseFloat(document.getElementById('qualityWeight').value);
    
    // 获取权重上限（自适应策略会动态调整，这里只是基础值）
    let maxWeight;
    if (useCompositeScore) {
        maxWeight = parseInt(document.getElementById('maxWeightSlider').value) / 100;
    } else if (useRiskParity) {
        maxWeight = 0.13;  // 自适应策略的基础值，实际会根据市场状态动态调整
    } else {
        maxWeight = parseInt(document.getElementById('mvMaxWeightSlider').value) / 100;
    }
    
    // 风险平价策略参数（自适应策略会自动调整这些参数）
    let riskParityParams = null;
    if (useRiskParity) {
        riskParityParams = {
            volatilityWindow: 6,  // 由自适应策略自动调整
            ewmaDecay: 0.91,      // 由自适应策略自动调整
            rebalanceFrequency: document.getElementById('rebalanceFrequency').value,
            enableTradingCost: document.getElementById('enableTradingCost').checked,
            tradingCostRate: document.getElementById('enableTradingCost').checked 
                ? parseInt(document.getElementById('tradingCostSlider').value) / 10000 
                : 0,
            riskFreeRate: parseFloat(document.getElementById('riskFreeRateInput').value) / 100,
            // 综合优化参数（已移除，由自适应策略控制）
            useQualityTilt: false,
            useCovariance: false,
            hybridRatio: 0,
            // 股票池筛选参数
            enableStockFilter: document.getElementById('enableStockFilter')?.checked || false,
            stockFilterParams: document.getElementById('enableStockFilter')?.checked ? {
                minROE: document.getElementById('enableROEFilter')?.checked 
                    ? parseFloat(document.getElementById('minROE').value) / 100 
                    : 0,
                maxDebtRatio: document.getElementById('enableDebtFilter')?.checked 
                    ? parseFloat(document.getElementById('maxDebtRatio').value) / 100 
                    : 1.0,
                momentumMonths: parseInt(document.getElementById('momentumMonths').value),
                minMomentumReturn: parseFloat(document.getElementById('minMomentumReturn').value) / 100,
                filterByQuality: document.getElementById('filterByQuality')?.checked || false
            } : null
        };
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
        useRiskParity,
        mvWeight,
        dvWeight,
        qualityWeight,
        qualityFactorType,
        maxWeight,
        riskParityParams
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
async function displayHoldingsTable(data) {
    if (data.length === 0) return;
    
    // 获取调仓变化数据
    let rebalanceChanges = [];
    try {
        rebalanceChanges = await fetchRebalanceChanges();
        console.log('调仓变化数据:', rebalanceChanges);
    } catch (error) {
        console.error('获取调仓变化数据失败:', error);
    }
    
    // 创建日期到变化的映射
    const changesMap = {};
    rebalanceChanges.forEach(change => {
        changesMap[change.date] = change;
    });
    
    // 填充调仓期选择下拉框（显示策略的所有调仓期）
    const periodSelect = document.getElementById('holdingsPeriodSelect');
    if (!periodSelect) {
        console.error('找不到holdingsPeriodSelect元素');
        return;
    }
    
    periodSelect.innerHTML = '';
    
    // 显示所有调仓期（data已经是策略的实际调仓期）
    data.forEach((period, index) => {
        const option = document.createElement('option');
        option.value = index;
        
        const date = period.rebalanceDate || period.reportDate;
        const dateFormatted = formatDate(date);
        
        // 查找该日期的调仓变化（如果有）
        const change = changesMap[date];
        if (change) {
            if (change.isInitial) {
                option.textContent = `${dateFormatted} [初始调仓: ${change.totalStocks}只]`;
            } else {
                const changeInfo = [];
                if (change.addedCount > 0) changeInfo.push(`+${change.addedCount}`);
                if (change.removedCount > 0) changeInfo.push(`-${change.removedCount}`);
                option.textContent = `${dateFormatted} [${changeInfo.join(' ')}只]`;
            }
        } else {
            // 没有调仓变化数据时，只显示日期和持仓数
            const stockCount = period.holdings ? period.holdings.length : 0;
            option.textContent = `${dateFormatted} [${stockCount}只]`;
        }
        
        periodSelect.appendChild(option);
    });
    
    // 监听报告期切换
    periodSelect.onchange = (e) => {
        const selectedIndex = parseInt(e.target.value);
        const selectedPeriod = data[selectedIndex];
        const change = changesMap[selectedPeriod.rebalanceDate || selectedPeriod.reportDate];
        renderHoldingsForPeriod(selectedPeriod, change);
    };
    
    // 默认显示第一个报告期
    const firstChange = changesMap[data[0].rebalanceDate || data[0].reportDate];
    renderHoldingsForPeriod(data[0], firstChange);
    
    document.getElementById('holdingsTable').style.display = 'block';
}

function renderHoldingsForPeriod(period, rebalanceChange) {
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
        if (currentConfig.useRiskParity) {
            holdingsNote.innerHTML = '<strong>💡 提示：</strong>左侧为指数持仓，右侧为策略持仓（风险平价策略）。';
        } else if (currentConfig.useCompositeScore) {
            holdingsNote.innerHTML = '<strong>💡 提示：</strong>左侧为指数持仓，右侧为策略持仓（综合得分策略）。';
        } else {
            holdingsNote.innerHTML = '<strong>💡 提示：</strong>左侧为指数持仓，右侧为策略持仓（市值加权策略）。';
        }
    }
    
    const strategyTitle = document.getElementById('strategyTitle');
    if (strategyTitle) {
        if (currentConfig.useRiskParity) {
            strategyTitle.textContent = `策略持仓 (${rebalanceDateFormatted})`;
        } else if (currentConfig.useCompositeScore) {
            strategyTitle.textContent = `策略持仓 (${rebalanceDateFormatted})`;
        } else {
            strategyTitle.textContent = `策略持仓 (${rebalanceDateFormatted})`;
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
    const sortedByIndex = [...period.holdings].sort((a, b) => (parseFloat(b.indexWeight) || 0) - (parseFloat(a.indexWeight) || 0));
    sortedByIndex.forEach((stock, index) => {
        const tr = document.createElement('tr');
        const indexWeight = parseFloat(stock.indexWeight) || 0;
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${stock.symbol}</td>
            <td>${stock.name || stock.symbol}</td>
            <td>${indexWeight.toFixed(2)}%</td>
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
    
    const sortedByAdjusted = [...period.holdings].sort((a, b) => (parseFloat(b.customWeight) || 0) - (parseFloat(a.customWeight) || 0));
    sortedByAdjusted.forEach((stock, index) => {
        const tr = document.createElement('tr');
        const customWeight = parseFloat(stock.customWeight) || 0;
        
        let rowHtml = `
            <td>${index + 1}</td>
            <td>${stock.symbol}</td>
            <td>${stock.name || stock.symbol}</td>
            <td>${(customWeight * 100).toFixed(2)}%</td>
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
    
    // 显示被筛选掉的股票（如果有）
    if (period.filteredOutStocks && period.filteredOutStocks.length > 0) {
        const separatorRow = document.createElement('tr');
        separatorRow.innerHTML = `<td colspan="8" style="background: #f8f9fa; padding: 10px; text-align: center; font-weight: bold; color: #666;">
            ❌ 以下股票被筛选掉（共${period.filteredOutStocks.length}只）
        </td>`;
        adjustedBody.appendChild(separatorRow);
        
        period.filteredOutStocks.forEach((stock, index) => {
            const tr = document.createElement('tr');
            tr.style.background = '#fff3cd';
            tr.style.opacity = '0.7';
            tr.innerHTML = `
                <td>${sortedByAdjusted.length + index + 1}</td>
                <td>${stock.symbol}</td>
                <td>${stock.name || stock.symbol}</td>
                <td style="color: #999;">-</td>
                <td colspan="4" style="color: #856404; font-size: 0.9em;">${stock.filterReason || '未通过筛选'}</td>
            `;
            adjustedBody.appendChild(tr);
        });
    }
}

function drawCumulativeReturnChart(data, customRisk, indexRisk, dailyData) {
    const ctx = document.getElementById('cumulativeReturnChart').getContext('2d');
    
    // 销毁旧图表实例（如果存在）
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    
    console.log('📊 绘制图表 - 数据统计:');
    console.log('  调仓期数据点:', data.length);
    console.log('  每日数据:', dailyData);
    
    // 准备数据：优先使用每日数据，否则使用调仓期数据
    let labels = [];
    let customData = [];
    let indexData = [];
    let fundData = [];
    let pointRadiusCustom = [];
    let pointRadiusIndex = [];
    let pointRadiusFund = [];
    
    // 创建调仓日期集合用于标记
    const rebalanceDates = new Set(data.map(d => d.rebalanceDate));
    const yearlyRebalanceDates = new Set(data.filter(d => d.isYearlyRebalance).map(d => d.rebalanceDate));
    
    if (dailyData && dailyData.custom && dailyData.custom.length > 0) {
        console.log('✅ 使用每日数据绘制平滑曲线');
        console.log('  自定义策略每日数据点:', dailyData.custom.length);
        console.log('  指数策略每日数据点:', dailyData.index.length);
        
        // 使用每日数据
        dailyData.custom.forEach((point, idx) => {
            const dateStr = point.date;
            labels.push(formatDate(dateStr));
            customData.push(point.cumulative * 100);
            
            // 在调仓日显示圆点
            const isRebalanceDate = rebalanceDates.has(dateStr);
            pointRadiusCustom.push(isRebalanceDate ? 4 : 0);
        });
        
        // 指数策略每日数据
        dailyData.index.forEach((point, idx) => {
            const dateStr = point.date;
            indexData.push(point.cumulative * 100);
            
            // 只在年度调仓日显示圆点
            const isYearlyRebalance = yearlyRebalanceDates.has(dateStr);
            pointRadiusIndex.push(isYearlyRebalance ? 4 : 0);
        });
        
        // 基金净值数据（从调仓期数据中获取）
        // 为每个交易日插值基金净值
        const fundDataMap = new Map();
        data.forEach(d => {
            fundDataMap.set(d.rebalanceDate, (d.fundCumulativeReturn !== undefined ? d.fundCumulativeReturn : d.fundReturn) * 100);
        });
        
        // 简单插值：使用最近的已知值
        let lastKnownFundValue = 0;
        dailyData.custom.forEach((point) => {
            const dateStr = point.date;
            if (fundDataMap.has(dateStr)) {
                lastKnownFundValue = fundDataMap.get(dateStr);
            }
            fundData.push(lastKnownFundValue);
            
            const isRebalanceDate = rebalanceDates.has(dateStr);
            pointRadiusFund.push(isRebalanceDate ? 4 : 0);
        });
        
    } else {
        console.log('⚠️ 无每日数据，使用调仓期数据');
        
        // 降级：使用调仓期数据（原有逻辑）
        data.forEach(d => {
            labels.push(formatDate(d.rebalanceDate));
            customData.push((d.customCumulativeReturn !== undefined ? d.customCumulativeReturn : d.customReturn) * 100);
            indexData.push((d.indexCumulativeReturn !== undefined ? d.indexCumulativeReturn : d.indexReturn) * 100);
            fundData.push((d.fundCumulativeReturn !== undefined ? d.fundCumulativeReturn : d.fundReturn) * 100);
            
            const isRebalanceDate = !d.isStartDate && !d.isEndDate;
            pointRadiusCustom.push(isRebalanceDate ? 4 : 0);
            pointRadiusIndex.push(isRebalanceDate && d.isYearlyRebalance ? 4 : 0);
            pointRadiusFund.push(isRebalanceDate ? 4 : 0);
        });
    }
    
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
                    tension: 0.4,
                    pointRadius: pointRadiusCustom,
                    pointHoverRadius: 6
                },
                {
                    label: 'h30269.CSI指数',
                    data: indexData,
                    borderColor: '#F18F01',
                    backgroundColor: 'rgba(241, 143, 1, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointRadius: pointRadiusIndex,
                    pointHoverRadius: 6
                },
                {
                    label: '512890.SH基金净值',
                    data: fundData,
                    borderColor: '#A23B72',
                    backgroundColor: 'rgba(162, 59, 114, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    borderDash: [5, 5],
                    pointRadius: pointRadiusFund,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        title: (context) => {
                            // 显示日期
                            return `日期: ${context[0].label}`;
                        },
                        label: (context) => {
                            // 显示策略名称和累计收益率
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
                        },
                        footer: (context) => {
                            // 如果是调仓日，显示标记
                            const dataIndex = context[0].dataIndex;
                            const dataset = context[0].dataset;
                            if (dataset.pointRadius && dataset.pointRadius[dataIndex] > 0) {
                                return '📍 调仓日';
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 20
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
            <span class="risk-value">${customRisk.sortinoRatio ? customRisk.sortinoRatio.toFixed(2) : '-'}</span>
        </div>
    `;
    
    indexMetrics.innerHTML = `
        <div class="risk-item">
            <span class="risk-label">累计收益率:</span>
            <span class="risk-value">${(indexRisk.totalReturn * 100).toFixed(2)}%</span>
        </div>
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
            <span class="risk-value">${indexRisk.sharpeRatio ? indexRisk.sharpeRatio.toFixed(2) : '-'}</span>
        </div>
        <div class="risk-item">
            <span class="risk-label">索提诺比率:</span>
            <span class="risk-value">${indexRisk.sortinoRatio ? indexRisk.sortinoRatio.toFixed(2) : '-'}</span>
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
    
    // 渲染风险收益指标对比表格
    renderComparisonTable(customRisk, indexRisk);
}

function renderComparisonTable(customRisk, indexRisk) {
    const comparisonTable = document.getElementById('comparisonTable');
    const comparisonTableBody = document.getElementById('comparisonTableBody');
    
    console.log('renderComparisonTable called', { comparisonTable, comparisonTableBody, customRisk, indexRisk });
    
    if (!comparisonTable || !comparisonTableBody) {
        console.error('对比表格元素未找到', { comparisonTable, comparisonTableBody });
        return;
    }
    
    // 计算差异
    const returnDiff = customRisk.annualizedReturn - indexRisk.annualizedReturn;
    const sharpeDiff = (customRisk.sharpeRatio || 0) - (indexRisk.sharpeRatio || 0);
    const sortinoDiff = (customRisk.sortinoRatio || 0) - (indexRisk.sortinoRatio || 0);
    const drawdownDiff = customRisk.maxDrawdown - indexRisk.maxDrawdown;
    
    // 生成对比数据
    const comparisons = [
        {
            metric: '年化收益率',
            strategy: `${(customRisk.annualizedReturn * 100).toFixed(1)}%`,
            index: `${(indexRisk.annualizedReturn * 100).toFixed(1)}%`,
            analysis: generateAnalysis('return', returnDiff, customRisk, indexRisk)
        },
        {
            metric: '夏普比率',
            strategy: customRisk.sharpeRatio ? customRisk.sharpeRatio.toFixed(2) : '-',
            index: indexRisk.sharpeRatio ? indexRisk.sharpeRatio.toFixed(2) : '-',
            analysis: generateAnalysis('sharpe', sharpeDiff, customRisk, indexRisk)
        },
        {
            metric: '索提诺比率',
            strategy: customRisk.sortinoRatio ? customRisk.sortinoRatio.toFixed(2) : '-',
            index: indexRisk.sortinoRatio ? indexRisk.sortinoRatio.toFixed(2) : '-',
            analysis: generateAnalysis('sortino', sortinoDiff, customRisk, indexRisk)
        },
        {
            metric: '卡玛比率',
            strategy: customRisk.maxDrawdown > 0 ? (customRisk.annualizedReturn / customRisk.maxDrawdown).toFixed(2) : '-',
            index: indexRisk.maxDrawdown > 0 ? (indexRisk.annualizedReturn / indexRisk.maxDrawdown).toFixed(2) : '-',
            analysis: '衡量回撤修复能力，数值越高表示单位回撤获得的收益越高'
        },
        {
            metric: '最大回撤',
            strategy: `${(customRisk.maxDrawdown * 100).toFixed(0)}%`,
            index: `${(indexRisk.maxDrawdown * 100).toFixed(0)}%`,
            analysis: generateAnalysis('drawdown', drawdownDiff, customRisk, indexRisk)
        },
        {
            metric: '波动率',
            strategy: `${(customRisk.volatility * 100).toFixed(1)}%`,
            index: `${(indexRisk.volatility * 100).toFixed(1)}%`,
            analysis: customRisk.volatility < indexRisk.volatility 
                ? '策略波动更小，风险控制更好' 
                : '策略波动较大，但可能带来更高收益'
        }
    ];
    
    // 生成表格HTML
    comparisonTableBody.innerHTML = comparisons.map(row => `
        <tr>
            <td class="metric-name">${row.metric}</td>
            <td class="strategy-col">${row.strategy}</td>
            <td class="index-col">${row.index}</td>
            <td class="analysis-col">${row.analysis}</td>
        </tr>
    `).join('');
    
    // 显示表格
    comparisonTable.style.display = 'block';
}

function generateAnalysis(type, diff, customRisk, indexRisk) {
    switch(type) {
        case 'return':
            if (Math.abs(diff) < 0.01) {
                return '两者收益率基本持平';
            } else if (diff > 0) {
                const pct = ((diff / indexRisk.annualizedReturn) * 100).toFixed(1);
                return `策略表现更优，超额收益 <span class="highlight-better">${(diff * 100).toFixed(2)}%</span>（相对提升${pct}%）`;
            } else {
                const pct = ((Math.abs(diff) / indexRisk.annualizedReturn) * 100).toFixed(1);
                return `指数表现更优，策略落后 <span class="highlight-worse">${(Math.abs(diff) * 100).toFixed(2)}%</span>（相对下降${pct}%）`;
            }
            
        case 'sharpe':
            if (Math.abs(diff) < 0.1) {
                return '风险调整后收益相当';
            } else if (diff > 0) {
                return `策略的单位风险收益更高，<span class="highlight-better">风险收益比更优</span>`;
            } else {
                return `指数的单位风险收益更高，<span class="highlight-worse">策略风险收益比较低</span>`;
            }
            
        case 'sortino':
            if (!indexRisk.sortinoRatio) {
                return '索提诺比率衡量下行风险控制能力';
            }
            if (Math.abs(diff) < 0.1) {
                return '下行风险控制能力相当';
            } else if (diff > 0) {
                return `策略在控制下行风险方面表现更好，<span class="highlight-better">更擅长控制下跌</span>`;
            } else {
                return `指数在控制下行风险方面表现更好`;
            }
            
        case 'drawdown':
            if (Math.abs(diff) < 0.02) {
                return '两者回撤控制能力相当';
            } else if (diff < 0) {
                return `策略的最大回撤更小，<span class="highlight-better">熊市中防御性更强</span>`;
            } else {
                return `指数的最大回撤更小，<span class="highlight-worse">策略在熊市中回撤较大</span>`;
            }
            
        default:
            return '';
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
    const changeEl = document.getElementById('constituentsRebalanceChange');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (resultEl) resultEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (changeEl) changeEl.style.display = 'none';
    
    try {
        // 获取成分股数据
        const response = await fetch(`${API_BASE}/index-constituents?date=${queryDate}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || '查询失败');
        }
        
        // 获取调仓变化数据
        let rebalanceChange = null;
        try {
            const changesResponse = await fetch(`${API_BASE}/rebalance-changes`);
            const changesResult = await changesResponse.json();
            if (changesResult.success) {
                rebalanceChange = changesResult.data.find(c => c.date === queryDate);
            }
        } catch (error) {
            console.error('获取调仓变化数据失败:', error);
        }
        
        // 显示结果
        displayConstituents(result.data);
        displayConstituentsRebalanceChange(rebalanceChange);
        
    } catch (error) {
        const loadingEl = document.getElementById('constituentsLoading');
        const errorEl = document.getElementById('constituentsError');
        const errorMsg = document.getElementById('constituentsErrorMessage');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'block';
        if (errorMsg) errorMsg.textContent = error.message;
    }
}

function displayConstituentsRebalanceChange(change) {
    const changeContainer = document.getElementById('constituentsRebalanceChange');
    if (!changeContainer) return;
    
    if (!change) {
        changeContainer.style.display = 'none';
        return;
    }
    
    changeContainer.style.display = 'block';
    
    let html = '<div class="rebalance-change-box">';
    
    if (change.isInitial) {
        html += `<h4>📊 初始调仓</h4>`;
        html += `<div class="change-summary">`;
        html += `<div class="summary-item">`;
        html += `<span class="summary-label">调仓日期</span>`;
        html += `<span class="summary-value">${formatDate(change.date)}</span>`;
        html += `</div>`;
        html += `<div class="summary-item">`;
        html += `<span class="summary-label">成分股数量</span>`;
        html += `<span class="summary-value"><strong>${change.totalStocks}只</strong></span>`;
        html += `</div>`;
        html += `</div>`;
    } else {
        html += `<h4>🔄 调仓变化对比</h4>`;
        
        // 添加调仓日期信息
        html += `<div class="change-summary">`;
        html += `<div class="summary-item">`;
        html += `<span class="summary-label">上期调仓日期</span>`;
        html += `<span class="summary-value">${formatDate(change.prevDate)}</span>`;
        html += `</div>`;
        html += `<div class="summary-item">`;
        html += `<span class="summary-label">本期调仓日期</span>`;
        html += `<span class="summary-value"><strong>${formatDate(change.date)}</strong></span>`;
        html += `</div>`;
        html += `</div>`;
        
        // 添加可视化对比图
        html += `<div class="change-visualization">`;
        html += `<div class="viz-row">`;
        html += `<div class="viz-item">`;
        html += `<div class="viz-label">上期成分股</div>`;
        html += `<div class="viz-bar prev-bar" style="width: ${Math.min(100, change.prevTotalStocks * 2)}px;">`;
        html += `<span class="viz-count">${change.prevTotalStocks}只</span>`;
        html += `</div>`;
        html += `</div>`;
        html += `<div class="viz-item">`;
        html += `<div class="viz-label">本期成分股</div>`;
        html += `<div class="viz-bar current-bar" style="width: ${Math.min(100, change.totalStocks * 2)}px;">`;
        html += `<span class="viz-count">${change.totalStocks}只</span>`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
        
        // 添加变化统计
        html += `<div class="change-stats">`;
        html += `<div class="stat-item stat-added">`;
        html += `<div class="stat-icon">➕</div>`;
        html += `<div class="stat-content">`;
        html += `<div class="stat-label">新增</div>`;
        html += `<div class="stat-value">${change.addedCount}只</div>`;
        html += `</div>`;
        html += `</div>`;
        html += `<div class="stat-item stat-removed">`;
        html += `<div class="stat-icon">➖</div>`;
        html += `<div class="stat-content">`;
        html += `<div class="stat-label">移除</div>`;
        html += `<div class="stat-value">${change.removedCount}只</div>`;
        html += `</div>`;
        html += `</div>`;
        html += `<div class="stat-item stat-unchanged">`;
        html += `<div class="stat-icon">✓</div>`;
        html += `<div class="stat-content">`;
        html += `<div class="stat-label">保持</div>`;
        html += `<div class="stat-value">${change.prevTotalStocks - change.removedCount}只</div>`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
        
        // 详细变化列表
        if (change.addedCount > 0) {
            html += `<div class="change-section">`;
            html += `<h5 style="color: #28a745;">➕ 新增成分股 (${change.addedCount} 只)</h5>`;
            html += `<div class="stock-list">`;
            change.added.forEach(code => {
                html += `<span class="stock-tag added">${code}</span>`;
            });
            html += `</div></div>`;
        }
        
        if (change.removedCount > 0) {
            html += `<div class="change-section">`;
            html += `<h5 style="color: #dc3545;">➖ 移除成分股 (${change.removedCount} 只)</h5>`;
            html += `<div class="stock-list">`;
            change.removed.forEach(code => {
                html += `<span class="stock-tag removed">${code}</span>`;
            });
            html += `</div></div>`;
        }
    }
    
    html += '</div>';
    changeContainer.innerHTML = html;
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
