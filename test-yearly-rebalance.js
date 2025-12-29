const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testYearlyRebalance() {
    console.log('===============================================');
    console.log('🔬 测试年度调仓 vs 季度调仓');
    console.log('===============================================\n');

    const testPeriods = [
        { name: '前期牛市', start: '20200710', end: '20211231' },
        { name: '全周期', start: '20200710', end: '20251229' }
    ];

    for (const period of testPeriods) {
        console.log(`\n📊 ${period.name}（${period.start} - ${period.end}）`);
        console.log('-----------------------------------------------');
        
        // 年度调仓
        try {
            const params1 = {
                startDate: period.start,
                endDate: period.end,
                strategyType: 'riskParity',
                useAdaptive: 'true',
                maxWeight: 0.13,
                volatilityWindow: 6,
                ewmaDecay: 0.91,
                rebalanceFrequency: 'yearly',
                enableTradingCost: false,
                riskFreeRate: 0.02,
                enableStockFilter: false
            };

            const response1 = await axios.get(`${API_BASE}/index-returns`, { params: params1 });
            const data1 = response1.data.data;
            
            console.log(`年度调仓:`);
            console.log(`   策略: ${(data1.customRisk.annualizedReturn * 100).toFixed(2)}%`);
            console.log(`   指数: ${(data1.indexRisk.annualizedReturn * 100).toFixed(2)}%`);
            console.log(`   差异: ${((data1.customRisk.annualizedReturn - data1.indexRisk.annualizedReturn) * 100).toFixed(2)}%`);
            
        } catch (error) {
            console.error(`   ❌ 年度调仓错误: ${error.message}`);
        }

        // 季度调仓
        try {
            const params2 = {
                startDate: period.start,
                endDate: period.end,
                strategyType: 'riskParity',
                useAdaptive: 'true',
                maxWeight: 0.13,
                volatilityWindow: 6,
                ewmaDecay: 0.91,
                rebalanceFrequency: 'quarterly',
                enableTradingCost: false,
                riskFreeRate: 0.02,
                enableStockFilter: false
            };

            const response2 = await axios.get(`${API_BASE}/index-returns`, { params: params2 });
            const data2 = response2.data.data;
            
            console.log(`\n季度调仓:`);
            console.log(`   策略: ${(data2.customRisk.annualizedReturn * 100).toFixed(2)}%`);
            console.log(`   指数: ${(data2.indexRisk.annualizedReturn * 100).toFixed(2)}%`);
            console.log(`   差异: ${((data2.customRisk.annualizedReturn - data2.indexRisk.annualizedReturn) * 100).toFixed(2)}%`);
            
        } catch (error) {
            console.error(`   ❌ 季度调仓错误: ${error.message}`);
        }
    }
}

testYearlyRebalance();
