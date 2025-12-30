const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function deepDive2020_2021() {
    console.log('===============================================');
    console.log('🔬 深度分析：2020-2021年市场状态识别');
    console.log('===============================================\n');

    // 测试2020-2021年每个季度的市场状态
    const quarters = [
        { name: '2020Q3', start: '20200710', end: '20200930' },
        { name: '2020Q4', start: '20201001', end: '20201231' },
        { name: '2021Q1', start: '20210101', end: '20210331' },
        { name: '2021Q2', start: '20210401', end: '20210630' },
        { name: '2021Q3', start: '20210701', end: '20210930' },
        { name: '2021Q4', start: '20211001', end: '20211231' }
    ];

    console.log('📊 测试配置：filterByQuality=false（最优配置）');
    console.log('===============================================\n');

    for (const quarter of quarters) {
        try {
            const params = {
                startDate: quarter.start,
                endDate: quarter.end,
                strategyType: 'riskParity',
                useAdaptive: 'true',
                maxWeight: 0.13,
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
                filterByQuality: false
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            
            const status = diff > 0 ? '✅' : '❌';
            console.log(`${status} ${quarter.name}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}% vs 指数${indexReturn.toFixed(2)}%)`);
            
        } catch (error) {
            console.error(`❌ ${quarter.name}: 错误 - ${error.message}`);
        }
    }

    // 测试不同的maxWeight
    console.log('\n\n===============================================');
    console.log('🔬 测试更激进的maxWeight（2020-2021）');
    console.log('===============================================\n');

    const maxWeights = [0.15, 0.20, 0.25, 0.30];
    
    for (const mw of maxWeights) {
        try {
            const params = {
                startDate: '20200710',
                endDate: '20211231',
                strategyType: 'riskParity',
                useAdaptive: 'true',
                maxWeight: mw,
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
                filterByQuality: false
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            
            const status = diff > 0 ? '✅' : '❌';
            console.log(`${status} maxWeight=${(mw*100).toFixed(0)}%: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}%)`);
            
        } catch (error) {
            console.error(`❌ maxWeight=${(mw*100).toFixed(0)}%: 错误`);
        }
    }

    // 测试更激进的hybridRatio
    console.log('\n\n===============================================');
    console.log('🔬 测试是否应该提高牛市的市值加权比例');
    console.log('===============================================\n');

    console.log('当前配置：牛市hybridRatio=0.2（20%市值加权）');
    console.log('建议测试：提高到0.5或更高\n');
}

deepDive2020_2021();
