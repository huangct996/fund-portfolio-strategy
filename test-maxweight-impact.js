const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testMaxWeightImpact() {
    console.log('===============================================');
    console.log('🔬 测试maxWeight对收益的影响（季度调仓）');
    console.log('===============================================\n');

    const maxWeights = [0.06, 0.08, 0.10, 0.13, 0.15, 0.18, 0.20, 0.25, 0.30];
    
    const results = [];
    
    for (const maxWeight of maxWeights) {
        const params = {
            startDate: '20200710',
            endDate: '20250710',
            strategyType: 'riskParity',
            useAdaptive: 'false',
            maxWeight: maxWeight,
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
            
            results.push({
                maxWeight: (maxWeight * 100).toFixed(0) + '%',
                annualizedReturn: (data.customRisk.annualizedReturn * 100).toFixed(2) + '%',
                sharpeRatio: data.customRisk.sharpeRatio.toFixed(4),
                maxDrawdown: (data.customRisk.maxDrawdown * 100).toFixed(2) + '%'
            });
            
            console.log(`maxWeight=${(maxWeight * 100).toFixed(0)}%: 年化=${(data.customRisk.annualizedReturn * 100).toFixed(2)}%, 夏普=${data.customRisk.sharpeRatio.toFixed(4)}`);
            
        } catch (error) {
            console.error(`❌ maxWeight=${maxWeight}时出错:`, error.message);
        }
    }
    
    console.log('\n===============================================');
    console.log('📊 结果汇总');
    console.log('===============================================\n');
    console.table(results);
    
    // 找出最优maxWeight
    const best = results.reduce((max, r) => 
        parseFloat(r.annualizedReturn) > parseFloat(max.annualizedReturn) ? r : max
    );
    
    console.log(`\n🏆 最优maxWeight: ${best.maxWeight}`);
    console.log(`   年化收益: ${best.annualizedReturn}`);
    console.log(`   夏普比率: ${best.sharpeRatio}`);
    
    console.log('\n===============================================');
    console.log('✅ 测试完成！');
    console.log('===============================================');
}

testMaxWeightImpact();
