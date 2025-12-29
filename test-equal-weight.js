const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testEqualWeight() {
    console.log('===============================================');
    console.log('🔬 测试等权重 vs 风险平价策略');
    console.log('===============================================\n');

    const periods = [
        { name: '前期牛市', start: '20200710', end: '20211231' },
        { name: '全周期', start: '20200710', end: '20251229' }
    ];

    for (const period of periods) {
        console.log(`\n📊 ${period.name}（${period.start} - ${period.end}）`);
        console.log('-----------------------------------------------');
        
        // 测试等权重策略
        try {
            const params1 = {
                startDate: period.start,
                endDate: period.end,
                strategyType: 'equalWeight',
                maxWeight: 0.20,
                rebalanceFrequency: 'quarterly',
                enableTradingCost: false,
                riskFreeRate: 0.02
            };

            const response1 = await axios.get(`${API_BASE}/index-returns`, { params: params1 });
            const data1 = response1.data.data;
            
            console.log('等权重策略:');
            console.log(`   年化收益: ${(data1.customRisk.annualizedReturn * 100).toFixed(2)}%`);
            console.log(`   夏普比率: ${data1.customRisk.sharpeRatio.toFixed(4)}`);
            console.log(`   最大回撤: ${(data1.customRisk.maxDrawdown * 100).toFixed(2)}%`);
            
        } catch (error) {
            console.error(`   ❌ 等权重错误: ${error.message}`);
        }

        // 测试风险平价策略
        try {
            const params2 = {
                startDate: period.start,
                endDate: period.end,
                strategyType: 'riskParity',
                useAdaptive: 'false',
                maxWeight: 0.20,
                volatilityWindow: 6,
                ewmaDecay: 0.91,
                rebalanceFrequency: 'quarterly',
                enableTradingCost: false,
                riskFreeRate: 0.02,
                enableStockFilter: false
            };

            const response2 = await axios.get(`${API_BASE}/index-returns`, { params: params2 });
            const data2 = response2.data.data;
            
            console.log('\n风险平价策略:');
            console.log(`   年化收益: ${(data2.customRisk.annualizedReturn * 100).toFixed(2)}%`);
            console.log(`   夏普比率: ${data2.customRisk.sharpeRatio.toFixed(4)}`);
            console.log(`   最大回撤: ${(data2.customRisk.maxDrawdown * 100).toFixed(2)}%`);
            
        } catch (error) {
            console.error(`   ❌ 风险平价错误: ${error.message}`);
        }

        // 指数基准
        try {
            const params3 = {
                startDate: period.start,
                endDate: period.end,
                strategyType: 'equalWeight',
                maxWeight: 0.20,
                rebalanceFrequency: 'quarterly',
                enableTradingCost: false,
                riskFreeRate: 0.02
            };

            const response3 = await axios.get(`${API_BASE}/index-returns`, { params: params3 });
            const data3 = response3.data.data;
            
            console.log('\n指数:');
            console.log(`   年化收益: ${(data3.indexRisk.annualizedReturn * 100).toFixed(2)}%`);
            console.log(`   夏普比率: ${data3.indexRisk.sharpeRatio.toFixed(4)}`);
            console.log(`   最大回撤: ${(data3.indexRisk.maxDrawdown * 100).toFixed(2)}%`);
            
        } catch (error) {
            console.error(`   ❌ 指数错误: ${error.message}`);
        }
    }
}

testEqualWeight();
