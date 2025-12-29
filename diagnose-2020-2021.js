const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function diagnose2020_2021() {
    console.log('===============================================');
    console.log('🔬 诊断2020-2021年跑输原因');
    console.log('===============================================\n');

    // 测试不同的配置
    const configs = [
        {
            name: '当前配置（启用质量筛选）',
            params: {
                enableStockFilter: true,
                minROE: 0,
                maxDebtRatio: 1,
                momentumMonths: 6,
                minMomentumReturn: -0.1,
                filterByQuality: true
            }
        },
        {
            name: '禁用质量筛选',
            params: {
                enableStockFilter: true,
                minROE: 0,
                maxDebtRatio: 1,
                momentumMonths: 6,
                minMomentumReturn: -0.1,
                filterByQuality: false
            }
        },
        {
            name: '完全禁用筛选',
            params: {
                enableStockFilter: false
            }
        },
        {
            name: '放宽动量要求',
            params: {
                enableStockFilter: true,
                minROE: 0,
                maxDebtRatio: 1,
                momentumMonths: 6,
                minMomentumReturn: -0.2,
                filterByQuality: true
            }
        },
        {
            name: '缩短动量周期',
            params: {
                enableStockFilter: true,
                minROE: 0,
                maxDebtRatio: 1,
                momentumMonths: 3,
                minMomentumReturn: -0.1,
                filterByQuality: true
            }
        }
    ];

    const periods = [
        { name: '2020年下半年', start: '20200710', end: '20201231' },
        { name: '2021年', start: '20210101', end: '20211231' }
    ];

    for (const config of configs) {
        console.log(`\n📊 配置：${config.name}`);
        console.log('===============================================');
        
        for (const period of periods) {
            try {
                const params = {
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
                    ...config.params
                };

                const response = await axios.get(`${API_BASE}/index-returns`, { params });
                const data = response.data.data;
                
                const customReturn = data.customRisk.annualizedReturn * 100;
                const indexReturn = data.indexRisk.annualizedReturn * 100;
                const diff = customReturn - indexReturn;
                const customSharpe = data.customRisk.sharpeRatio;
                
                const status = diff > 0 ? '✅' : '❌';
                console.log(`${status} ${period.name}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}%, 夏普${customSharpe.toFixed(4)})`);
                
            } catch (error) {
                console.error(`❌ ${period.name}: 错误 - ${error.message}`);
            }
        }
    }

    // 测试不同的maxWeight
    console.log('\n\n===============================================');
    console.log('🔬 测试不同maxWeight的影响（2020-2021）');
    console.log('===============================================\n');

    const maxWeights = [0.10, 0.13, 0.15, 0.18, 0.20, 0.25];
    
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
                filterByQuality: false  // 禁用质量筛选
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
}

diagnose2020_2021();
