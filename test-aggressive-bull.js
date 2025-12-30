const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testAggressiveBull() {
    console.log('===============================================');
    console.log('🚀 测试极度激进的牛市策略（2020-2021）');
    console.log('===============================================\n');

    const strategies = [
        {
            name: '当前策略',
            params: {
                enableStockFilter: true,
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
            name: '放宽动量要求到-20%',
            params: {
                enableStockFilter: true,
                minMomentumReturn: -0.2,
                filterByQuality: false
            }
        },
        {
            name: '放宽动量要求到-30%',
            params: {
                enableStockFilter: true,
                minMomentumReturn: -0.3,
                filterByQuality: false
            }
        },
        {
            name: '完全不限制动量',
            params: {
                enableStockFilter: true,
                minMomentumReturn: -1.0,
                filterByQuality: false
            }
        }
    ];

    for (const strategy of strategies) {
        try {
            const params = {
                startDate: '20200710',
                endDate: '20211231',
                strategyType: 'riskParity',
                useAdaptive: 'false',
                maxWeight: 0.20,
                volatilityWindow: 6,
                ewmaDecay: 0.91,
                rebalanceFrequency: 'quarterly',
                enableTradingCost: false,
                riskFreeRate: 0.02,
                minROE: 0,
                maxDebtRatio: 1,
                momentumMonths: 6,
                ...strategy.params
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            
            const status = diff > 0 ? '✅' : '❌';
            console.log(`${status} ${strategy.name}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}%)`);
            
        } catch (error) {
            console.error(`❌ ${strategy.name}: 错误`);
        }
    }

    console.log('\n\n===============================================');
    console.log('📊 结论');
    console.log('===============================================\n');
    console.log('如果完全禁用筛选或放宽动量要求能显著改善：');
    console.log('  → 说明动量筛选过滤掉了2020-2021年的高涨幅股票\n');
    console.log('如果仍然无法跑赢：');
    console.log('  → 说明风险平价本身的权重分配机制限制了收益');
    console.log('  → 需要引入更多市值加权或等权重策略');
}

testAggressiveBull();
