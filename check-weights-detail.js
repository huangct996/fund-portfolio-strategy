const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function checkWeightsDetail() {
    console.log('===============================================');
    console.log('🔬 检查实际权重分配');
    console.log('===============================================\n');

    try {
        const params = {
            startDate: '20200710',
            endDate: '20201231',
            strategyType: 'riskParity',
            useAdaptive: 'true',
            maxWeight: 0.20,  // 设置很高的maxWeight
            volatilityWindow: 6,
            ewmaDecay: 0.91,
            rebalanceFrequency: 'quarterly',
            enableTradingCost: false,
            riskFreeRate: 0.02,
            enableStockFilter: false
        };

        const response = await axios.get(`${API_BASE}/index-returns`, { params });
        const data = response.data.data;
        
        console.log('📊 前3个调仓期的权重分布：\n');
        
        for (let i = 0; i < Math.min(3, data.periods.length); i++) {
            const period = data.periods[i];
            console.log(`调仓期 ${i + 1}: ${period.date}`);
            
            if (period.weights && period.weights.length > 0) {
                // 按权重排序
                const sortedWeights = [...period.weights].sort((a, b) => b.weight - a.weight);
                
                console.log(`  总股票数: ${sortedWeights.length}`);
                console.log(`  前10大权重:`);
                for (let j = 0; j < Math.min(10, sortedWeights.length); j++) {
                    const w = sortedWeights[j];
                    console.log(`    ${j + 1}. ${w.code}: ${(w.weight * 100).toFixed(2)}%`);
                }
                
                // 统计权重分布
                const maxW = Math.max(...sortedWeights.map(w => w.weight));
                const avgW = sortedWeights.reduce((sum, w) => sum + w.weight, 0) / sortedWeights.length;
                const top10Weight = sortedWeights.slice(0, 10).reduce((sum, w) => sum + w.weight, 0);
                
                console.log(`  最大权重: ${(maxW * 100).toFixed(2)}%`);
                console.log(`  平均权重: ${(avgW * 100).toFixed(2)}%`);
                console.log(`  前10占比: ${(top10Weight * 100).toFixed(2)}%`);
            }
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

checkWeightsDetail();
