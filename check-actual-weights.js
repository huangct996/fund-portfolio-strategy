const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function checkActualWeights() {
    console.log('===============================================');
    console.log('🔬 检查实际权重分布');
    console.log('===============================================\n');

    const params = {
        startDate: '20200710',
        endDate: '20250710',
        strategyType: 'riskParity',
        useAdaptive: 'false',
        maxWeight: 0.30,  // 设置一个很高的上限
        volatilityWindow: 6,
        ewmaDecay: 0.91,
        rebalanceFrequency: 'quarterly',
        enableTradingCost: false,
        riskFreeRate: 0.02,
        enableStockFilter: true,
        minROE: 0,
        maxDebtRatio: 1,
        momentumMonths: 6,
        minMomentumReturn: -0.1,
        filterByQuality: true
    };

    try {
        const response = await axios.get(`${API_BASE}/index-returns`, { params });
        const data = response.data.data;
        
        console.log(`总调仓期数: ${data.periods.length}\n`);
        
        // 检查前5个调仓期的权重分布
        for (let i = 0; i < Math.min(5, data.periods.length); i++) {
            const period = data.periods[i];
            console.log(`调仓期 ${i + 1}: ${period.date}`);
            
            if (period.currentWeights) {
                const weights = Object.entries(period.currentWeights)
                    .map(([code, weight]) => ({ code, weight }))
                    .sort((a, b) => b.weight - a.weight)
                    .slice(0, 10);  // 只看前10大权重
                
                console.log('  前10大权重:');
                weights.forEach((w, idx) => {
                    console.log(`    ${idx + 1}. ${w.code}: ${(w.weight * 100).toFixed(2)}%`);
                });
                
                const maxWeight = Math.max(...Object.values(period.currentWeights));
                console.log(`  最大权重: ${(maxWeight * 100).toFixed(2)}%\n`);
            }
        }
        
        console.log('===============================================');
        console.log('✅ 检查完成！');
        console.log('===============================================');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    }
}

checkActualWeights();
