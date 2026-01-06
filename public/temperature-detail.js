/**
 * 温度详情页面 JavaScript
 */

let temperatureChart = null;
let multiIndexData = null;

// 指数配置
const indexConfig = {
    '000300.SH': { name: '沪深300', color: '#2196f3' },
    '000905.SH': { name: '中证500', color: '#4caf50' },
    '000852.SH': { name: '中证1000', color: '#ff9800' },
    '000016.SH': { name: '上证50', color: '#9c27b0' }
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadCompositeTemperature();
    await loadMultiIndexTemperature();
    setupEventListeners();
});

// 加载综合温度
async function loadCompositeTemperature() {
    try {
        const response = await fetch('/api/composite-temperature');
        const result = await response.json();
        
        if (result.success) {
            displayCompositeTemperature(result.data);
        } else {
            showError('compositeTemperature', '加载综合温度失败');
        }
    } catch (error) {
        console.error('加载综合温度失败:', error);
        showError('compositeTemperature', '加载综合温度失败');
    }
}

// 显示综合温度
function displayCompositeTemperature(data) {
    const container = document.getElementById('compositeTemperature');
    
    const levelClass = data.level === 'COLD' ? 'cold' : data.level === 'HOT' ? 'hot' : 'normal';
    const levelColor = data.level === 'COLD' ? '#2196f3' : data.level === 'HOT' ? '#f44336' : '#ffc107';
    
    container.innerHTML = `
        <div class="temperature-level">${data.levelName || '中估'}</div>
        <div class="temperature-value" style="color: ${levelColor}">${data.temperature}°</div>
        <div style="font-size: 16px; margin-top: 10px;">
            ${data.suggestion || ''}
        </div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.3);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">置信度</div>
                    <div style="font-size: 24px; font-weight: bold;">${(data.confidence * 100).toFixed(0)}%</div>
                </div>
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">有效指数</div>
                    <div style="font-size: 24px; font-weight: bold;">${data.composition?.validIndices || 0}/${data.composition?.totalIndices || 4}</div>
                </div>
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">单只股票最大权重</div>
                    <div style="font-size: 24px; font-weight: bold;">${(data.params?.maxWeight * 100).toFixed(0)}%</div>
                </div>
                <div>
                    <div style="font-size: 14px; opacity: 0.9;">波动率窗口</div>
                    <div style="font-size: 24px; font-weight: bold;">${data.params?.volatilityWindow || 6}月</div>
                </div>
            </div>
        </div>
    `;
    
    // 显示各指数温度
    if (data.indexTemperatures && data.indexTemperatures.length > 0) {
        displayIndicesGrid(data.indexTemperatures);
    }
}

// 显示各指数温度网格
function displayIndicesGrid(indexTemperatures) {
    const container = document.getElementById('indicesGrid');
    
    container.innerHTML = indexTemperatures.map(index => {
        const levelClass = index.level === 'COLD' ? 'cold' : index.level === 'HOT' ? 'hot' : 'normal';
        const tempColor = index.level === 'COLD' ? '#2196f3' : index.level === 'HOT' ? '#f44336' : '#ffc107';
        
        // 检查数据是否可用
        const hasPEPB = index.pe != null && index.pb != null;
        const peDisplay = hasPEPB ? `${index.pe.toFixed(2)} (温度${index.peTemp}°)` : '暂无数据';
        const pbDisplay = hasPEPB ? `${index.pb.toFixed(2)} (温度${index.pbTemp}°)` : '暂无数据';
        
        return `
            <div class="index-card ${levelClass}">
                <div class="index-name">${index.name}</div>
                <div class="index-temp" style="color: ${tempColor}">${index.temperature}°</div>
                <div style="font-size: 14px; color: #666; margin-bottom: 5px;">${index.levelName}</div>
                <div class="index-details">
                    <div>PE: ${peDisplay}</div>
                    <div>PB: ${pbDisplay}</div>
                    <div style="margin-top: 5px; font-weight: 500;">权重: ${(index.weight * 100).toFixed(0)}%</div>
                    ${!hasPEPB ? '<div style="margin-top: 5px; color: #ff9800; font-size: 12px;">⚠️ 该指数暂无估值数据</div>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 加载多指数历史温度
async function loadMultiIndexTemperature() {
    try {
        const timeRange = document.getElementById('timeRange').value;
        const { startDate, endDate } = getDateRange(timeRange);
        
        console.log('正在加载多指数温度数据...', { startDate, endDate });
        
        const response = await fetch(`/api/multi-index-temperature?startDate=${startDate}&endDate=${endDate}`);
        const result = await response.json();
        
        console.log('API响应:', result);
        
        if (result.success) {
            multiIndexData = result.data;
            console.log('multiIndexData已设置:', multiIndexData);
            
            // 先显示分布统计（不依赖Chart.js）
            console.log('开始显示分布统计...');
            try {
                displayDistributionStats();
                console.log('分布统计显示完成');
            } catch (error) {
                console.error('显示分布统计失败:', error);
            }
            
            // 再更新图表（可能依赖Chart.js）
            console.log('开始更新图表...');
            try {
                updateTemperatureChart();
                console.log('图表更新完成');
            } catch (error) {
                console.error('图表更新失败:', error);
            }
            
            console.log('数据加载完成');
        } else {
            console.error('加载多指数温度失败:', result.error);
            showError('distributionStats', '加载失败: ' + result.error);
        }
    } catch (error) {
        console.error('加载多指数温度失败:', error);
        showError('distributionStats', '加载失败: ' + error.message);
    }
}

// 获取日期范围
function getDateRange(range) {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
        case '1y':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        case '3y':
            startDate.setFullYear(endDate.getFullYear() - 3);
            break;
        case '5y':
            startDate.setFullYear(endDate.getFullYear() - 5);
            break;
        case 'all':
            startDate.setFullYear(2005);
            break;
    }
    
    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}

// 格式化日期为YYYYMMDD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// 更新温度曲线图
function updateTemperatureChart() {
    if (!multiIndexData) {
        console.warn('multiIndexData为空，跳过图表更新');
        return;
    }
    
    const chartElement = document.getElementById('temperatureChart');
    if (!chartElement) {
        console.error('找不到temperatureChart元素');
        return;
    }
    
    const ctx = chartElement.getContext('2d');
    
    // 销毁旧图表
    if (temperatureChart) {
        temperatureChart.destroy();
    }
    
    // 准备数据集
    const datasets = [];
    
    // 综合温度
    if (document.getElementById('showComposite').checked && multiIndexData.composite) {
        datasets.push({
            label: '综合温度',
            data: multiIndexData.composite.temperatures.map(t => ({
                x: formatDateForChart(t.date),
                y: t.temperature
            })),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHitRadius: 15
        });
    }
    
    // 各指数温度
    for (const [code, config] of Object.entries(indexConfig)) {
        const checkboxId = `show${code.replace('.', '')}`;
        if (document.getElementById(checkboxId).checked && multiIndexData.indices[code]) {
            datasets.push({
                label: config.name,
                data: multiIndexData.indices[code].temperatures.map(t => ({
                    x: formatDateForChart(t.date),
                    y: t.temperature
                })),
                borderColor: config.color,
                backgroundColor: `${config.color}20`,
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHitRadius: 15
            });
        }
    }
    
    // 创建图表
    temperatureChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y}°`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: {
                            month: 'YYYY-MM'
                        }
                    },
                    title: {
                        display: true,
                        text: '日期'
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: '温度 (°)'
                    },
                    grid: {
                        color: function(context) {
                            if (context.tick.value === 30 || context.tick.value === 70) {
                                return 'rgba(255, 99, 132, 0.3)';
                            }
                            return 'rgba(0, 0, 0, 0.1)';
                        }
                    }
                }
            }
        }
    });
}

// 格式化日期用于图表显示
function formatDateForChart(dateStr) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
}

// 显示温度分布统计
function displayDistributionStats() {
    console.log('displayDistributionStats被调用');
    console.log('multiIndexData:', multiIndexData);
    
    if (!multiIndexData) {
        console.warn('multiIndexData is null');
        const container = document.getElementById('distributionStats');
        if (container) {
            container.innerHTML = '<div class="loading">数据未加载</div>';
        }
        return;
    }
    
    const container = document.getElementById('distributionStats');
    if (!container) {
        console.error('找不到distributionStats容器');
        return;
    }
    
    console.log('容器元素找到:', container);
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">';
    
    let hasData = false;
    
    // 综合温度分布
    console.log('检查综合温度分布:', multiIndexData.composite);
    if (multiIndexData.composite && multiIndexData.composite.distribution) {
        console.log('添加综合温度卡片');
        html += createDistributionCard('综合温度', multiIndexData.composite.distribution);
        hasData = true;
    } else {
        console.warn('综合温度分布不存在');
    }
    
    // 各指数分布
    if (multiIndexData.indices) {
        console.log('检查各指数分布:', Object.keys(multiIndexData.indices));
        for (const [code, data] of Object.entries(multiIndexData.indices)) {
            console.log(`检查指数 ${code}:`, data);
            if (data && data.distribution && data.distribution.average) {
                console.log(`添加 ${data.name} 卡片`);
                html += createDistributionCard(data.name, data.distribution);
                hasData = true;
            } else {
                console.warn(`${code} 数据不完整`);
            }
        }
    } else {
        console.warn('indices数据不存在');
    }
    
    html += '</div>';
    
    console.log('hasData:', hasData);
    console.log('生成的HTML长度:', html.length);
    
    if (hasData) {
        container.innerHTML = html;
        console.log('HTML已设置到容器');
    } else {
        container.innerHTML = '<div class="loading">暂无温度分布数据</div>';
        console.log('显示无数据提示');
    }
}

// 创建分布统计卡片
function createDistributionCard(name, distribution) {
    return `
        <div style="padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="margin-top: 0;">${name}</h3>
            <div style="margin-bottom: 15px;">
                <div style="font-size: 14px; color: #666;">平均温度</div>
                <div style="font-size: 32px; font-weight: bold; color: #667eea;">${distribution.average}°</div>
            </div>
            <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #e3f2fd; border-radius: 4px;">
                    <span>低估 (0-30°)</span>
                    <strong>${distribution.cold.percentage}%</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #fff3cd; border-radius: 4px;">
                    <span>中估 (30-70°)</span>
                    <strong>${distribution.normal.percentage}%</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #ffebee; border-radius: 4px;">
                    <span>高估 (70-100°)</span>
                    <strong>${distribution.hot.percentage}%</strong>
                </div>
            </div>
        </div>
    `;
}

// 设置事件监听器
function setupEventListeners() {
    // 时间范围变化
    document.getElementById('timeRange').addEventListener('change', () => {
        loadMultiIndexTemperature();
    });
    
    // 图表显示控制
    ['showComposite', 'show000300', 'show000905', 'show000852', 'show000016'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                updateTemperatureChart();
            });
        }
    });
}

// 显示错误信息
function showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div class="loading" style="color: #f44336;">${message}</div>`;
}
