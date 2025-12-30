const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testMarketCapWeight() {
    console.log('===============================================');
    console.log('🎯 测试市值加权比例对2020-2021年的影响');
    console.log('===============================================\n');

    console.log('假设：风险平价在牛市期间过于保守，需要更多市值加权\n');

    // 注意：hybridRatio需要通过修改代码来测试，因为前端无法直接设置
    // 这里我们测试不同的策略类型
    
    const strategies = [
        {
            name: '纯风险平价',
            strategyType: 'riskParity',
            desc: '基于波动率倒数分配权重'
        },
        {
            name: '等权重',
            strategyType: 'equalWeight',
            desc: '所有股票等权重'
        },
        {
            name: '市值加权',
            strategyType: 'marketCap',
            desc: '按市值比例分配权重'
        }
    ];

    for (const strategy of strategies) {
        try {
            const params = {
                startDate: '20200710',
                endDate: '20211231',
                strategyType: strategy.strategyType,
                useAdaptive: 'false',
                maxWeight: 0.20,
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
            console.log(`${status} ${strategy.name}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}%)`);
            console.log(`   ${strategy.desc}\n`);
            
        } catch (error) {
            console.error(`❌ ${strategy.name}: 错误\n`);
        }
    }

    console.log('\n===============================================');
    console.log('📊 最终结论');
    console.log('===============================================\n');
    console.log('如果市值加权或等权重能跑赢指数：');
    console.log('  → 说明风险平价的波动率倒数权重在牛市期间确实过于保守');
    console.log('  → 应该在自适应策略的牛市状态中大幅提高hybridRatio\n');
    console.log('如果所有策略都跑输：');
    console.log('  → 说明2020-2021年跑输是股票筛选和调仓频率的综合结果');
    console.log('  → 这是策略设计的权衡，为了全周期稳定性牺牲了部分牛市收益');
}

testMarketCapWeight();
