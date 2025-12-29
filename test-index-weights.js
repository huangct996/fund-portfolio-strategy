const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testIndexWeights() {
    console.log('===============================================');
    console.log('🔬 测试直接使用指数权重');
    console.log('===============================================\n');

    const periods = [
        { name: '前期牛市', start: '20200710', end: '20211231' },
        { name: '全周期', start: '20200710', end: '20251229' }
    ];

    for (const period of periods) {
        console.log(`\n📊 ${period.name}（${period.start} - ${period.end}）`);
        console.log('-----------------------------------------------');
        
        // 测试市值加权策略（接近指数权重）
        try {
            const params = {
                startDate: period.start,
                endDate: period.end,
                strategyType: 'marketValue',
                maxWeight: 1.0,  // 不限制权重，完全按市值
                rebalanceFrequency: 'quarterly',
                enableTradingCost: false,
                riskFreeRate: 0.02
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            
            console.log(`市值加权策略（无限制）:`);
            console.log(`   年化收益: ${customReturn.toFixed(2)}%`);
            console.log(`   vs指数: ${indexReturn.toFixed(2)}%`);
            console.log(`   差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% ${diff > 0 ? '✅' : '❌'}`);
            console.log(`   夏普比率: ${data.customRisk.sharpeRatio.toFixed(4)}`);
            
        } catch (error) {
            console.error(`   ❌ 错误: ${error.message}`);
        }
    }
}

testIndexWeights();
