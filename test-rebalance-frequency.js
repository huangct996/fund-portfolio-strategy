const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testRebalanceFrequency() {
    console.log('===============================================');
    console.log('🔬 测试不同调仓频率的影响');
    console.log('===============================================\n');

    const frequencies = ['yearly', 'quarterly', 'monthly'];
    
    for (const freq of frequencies) {
        console.log(`\n📊 调仓频率: ${freq}`);
        console.log('-----------------------------------------------');
        
        // 前期牛市
        try {
            const params1 = {
                startDate: '20200710',
                endDate: '20211231',
                strategyType: 'riskParity',
                useAdaptive: 'true',
                maxWeight: 0.13,
                volatilityWindow: 6,
                ewmaDecay: 0.91,
                rebalanceFrequency: freq,
                enableTradingCost: false,
                riskFreeRate: 0.02,
                enableStockFilter: false
            };

            const response1 = await axios.get(`${API_BASE}/index-returns`, { params: params1 });
            const data1 = response1.data.data;
            
            const customReturn1 = data1.customRisk.annualizedReturn * 100;
            const indexReturn1 = data1.indexRisk.annualizedReturn * 100;
            const diff1 = customReturn1 - indexReturn1;
            
            console.log(`前期牛市（2020-2021）:`);
            console.log(`   策略年化: ${customReturn1.toFixed(2)}%`);
            console.log(`   指数年化: ${indexReturn1.toFixed(2)}%`);
            console.log(`   差异: ${diff1 > 0 ? '+' : ''}${diff1.toFixed(2)}% ${diff1 > 0 ? '✅' : '❌'}`);
            
        } catch (error) {
            console.error(`   ❌ 前期错误: ${error.message}`);
        }

        // 全周期
        try {
            const params2 = {
                startDate: '20200710',
                endDate: '20251229',
                strategyType: 'riskParity',
                useAdaptive: 'true',
                maxWeight: 0.13,
                volatilityWindow: 6,
                ewmaDecay: 0.91,
                rebalanceFrequency: freq,
                enableTradingCost: false,
                riskFreeRate: 0.02,
                enableStockFilter: false
            };

            const response2 = await axios.get(`${API_BASE}/index-returns`, { params: params2 });
            const data2 = response2.data.data;
            
            const customReturn2 = data2.customRisk.annualizedReturn * 100;
            const indexReturn2 = data2.indexRisk.annualizedReturn * 100;
            const diff2 = customReturn2 - indexReturn2;
            
            console.log(`\n全周期（2020-2025）:`);
            console.log(`   策略年化: ${customReturn2.toFixed(2)}%`);
            console.log(`   指数年化: ${indexReturn2.toFixed(2)}%`);
            console.log(`   差异: ${diff2 > 0 ? '+' : ''}${diff2.toFixed(2)}% ${diff2 > 0 ? '✅' : '❌'}`);
            console.log(`   夏普比率: ${data2.customRisk.sharpeRatio.toFixed(4)}`);
            
        } catch (error) {
            console.error(`   ❌ 全周期错误: ${error.message}`);
        }
    }
}

testRebalanceFrequency();
