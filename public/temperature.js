/**
 * 市场温度计前端模块
 */

let temperatureChart = null;
let fullTemperatureData = [];

/**
 * 加载并显示市场温度计（简化版）
 */
async function loadMarketTemperature() {
    try {
        // 加载当前温度并更新横幅
        await loadCurrentTemperature();
    } catch (error) {
        console.error('加载市场温度失败:', error);
        const banner = document.getElementById('tempBannerText');
        if (banner) {
            banner.textContent = '加载失败';
        }
    }
}

/**
 * 加载当前市场温度（多指数综合）
 */
async function loadCurrentTemperature() {
    try {
        const response = await fetch('/api/composite-temperature');
        const result = await response.json();
        
        if (result.success) {
            displayCurrentTemperature(result.data);
        } else {
            throw new Error(result.error || '获取当前温度失败');
        }
    } catch (error) {
        console.error('加载当前温度失败:', error);
        document.getElementById('currentTempValue').textContent = '--°';
        document.getElementById('currentTempLevel').textContent = '加载失败';
        document.getElementById('currentTempSuggestion').textContent = error.message;
    }
}

/**
 * 显示当前温度（简化版横幅）
 */
function displayCurrentTemperature(data) {
    const banner = document.getElementById('tempBannerText');
    const container = document.getElementById('marketTempBanner');
    
    if (!banner || !container) return;
    
    // 根据温度级别设置颜色
    let bgColor, emoji;
    const level = data.level || 'NORMAL';
    
    if (level === 'COLD') {
        bgColor = 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)';
        emoji = '❄️';
    } else if (level === 'HOT') {
        bgColor = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
        emoji = '🔥';
    } else {
        bgColor = 'linear-gradient(135deg, #ffc107 0%, #ffa000 100%)';
        emoji = '☀️';
    }
    
    // 更新横幅样式和内容
    container.style.background = bgColor;
    banner.innerHTML = `${emoji} 当前 ${data.temperature}° (${data.levelName || '中估'}) - ${data.suggestion || ''}`;
}

/**
 * 加载历史温度数据
 */
async function loadHistoricalTemperature(period) {
    try {
        const { startDate, endDate } = getPeriodDates(period);
        
        const response = await fetch(`/api/historical-temperature?indexCode=000300.SH&startDate=${startDate}&endDate=${endDate}`);
        const result = await response.json();
        
        if (result.success) {
            fullTemperatureData = result.data.temperatures;
            displayTemperatureChart(fullTemperatureData);
            displayTemperatureDistribution(result.data.distribution);
        } else {
            throw new Error(result.error || '获取历史温度失败');
        }
    } catch (error) {
        console.error('加载历史温度失败:', error);
        showError('加载历史温度失败: ' + error.message);
    }
}

/**
 * 获取时间段的起止日期
 */
function getPeriodDates(period) {
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    let startDate;
    const startDateObj = new Date(today);
    
    switch (period) {
        case '1year':
            startDateObj.setFullYear(startDateObj.getFullYear() - 1);
            break;
        case '3years':
            startDateObj.setFullYear(startDateObj.getFullYear() - 3);
            break;
        case '5years':
            startDateObj.setFullYear(startDateObj.getFullYear() - 5);
            break;
        case 'all':
            startDate = '20050101'; // 从2005年开始
            return { startDate, endDate };
        default:
            startDateObj.setFullYear(startDateObj.getFullYear() - 1);
    }
    
    startDate = startDateObj.toISOString().slice(0, 10).replace(/-/g, '');
    return { startDate, endDate };
}

/**
 * 显示温度曲线图
 */
function displayTemperatureChart(data) {
    const ctx = document.getElementById('temperatureChart');
    if (!ctx) return;
    
    // 销毁旧图表
    if (temperatureChart) {
        temperatureChart.destroy();
    }
    
    // 准备数据
    const labels = data.map(d => {
        const date = d.date;
        return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
    });
    
    const temperatures = data.map(d => d.temperature);
    
    // 创建背景色数据（根据温度区间）
    const backgroundColors = temperatures.map(temp => {
        if (temp < 30) return 'rgba(59, 130, 246, 0.1)'; // 蓝色（低估）
        if (temp < 70) return 'rgba(251, 191, 36, 0.1)'; // 黄色（中估）
        return 'rgba(239, 68, 68, 0.1)'; // 红色（高估）
    });
    
    // 创建图表
    temperatureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '市场温度',
                data: temperatures,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,              // 隐藏所有圆点，使曲线更柔顺
                pointHoverRadius: 6,         // 鼠标悬停时显示圆点
                pointHitRadius: 15           // 增大鼠标感应区域，便于交互
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const temp = context.parsed.y;
                            let level = '中估';
                            if (temp < 30) level = '低估';
                            else if (temp >= 70) level = '高估';
                            return `温度: ${temp}° (${level})`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 30,
                            yMax: 30,
                            borderColor: 'rgba(59, 130, 246, 0.5)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: '低估线 (30°)',
                                enabled: true,
                                position: 'end'
                            }
                        },
                        line2: {
                            type: 'line',
                            yMin: 70,
                            yMax: 70,
                            borderColor: 'rgba(239, 68, 68, 0.5)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: '高估线 (70°)',
                                enabled: true,
                                position: 'end'
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: '温度 (°)'
                    },
                    grid: {
                        color: function(context) {
                            if (context.tick.value === 30 || context.tick.value === 70) {
                                return 'rgba(0, 0, 0, 0.2)';
                            }
                            return 'rgba(0, 0, 0, 0.05)';
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    },
                    ticks: {
                        maxTicksLimit: 12,
                        autoSkip: true
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

/**
 * 显示温度分布统计
 */
function displayTemperatureDistribution(distribution) {
    if (!distribution) return;
    
    // 低估区间
    document.getElementById('coldCount').textContent = distribution.cold.count + '次';
    document.getElementById('coldPercent').textContent = distribution.cold.percentage + '%';
    
    // 中估区间
    document.getElementById('normalCount').textContent = distribution.normal.count + '次';
    document.getElementById('normalPercent').textContent = distribution.normal.percentage + '%';
    
    // 高估区间
    document.getElementById('hotCount').textContent = distribution.hot.count + '次';
    document.getElementById('hotPercent').textContent = distribution.hot.percentage + '%';
    
    // 平均温度
    document.getElementById('avgTemperature').textContent = distribution.avgTemperature + '°';
}

/**
 * 绑定时间筛选按钮事件
 */
function bindFilterButtons() {
    const buttons = document.querySelectorAll('.filter-btn');
    
    buttons.forEach(button => {
        button.addEventListener('click', async function() {
            // 移除所有active类
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // 添加active类到当前按钮
            this.classList.add('active');
            
            // 获取时间段
            const period = this.dataset.period;
            
            // 重新加载数据
            await loadHistoricalTemperature(period);
        });
    });
}

/**
 * 显示错误信息
 */
function showError(message) {
    // 可以使用更友好的错误提示方式
    console.error(message);
    alert(message);
}

// 导出函数供外部使用
window.loadMarketTemperature = loadMarketTemperature;
