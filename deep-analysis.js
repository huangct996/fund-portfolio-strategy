const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function deepAnalysis() {
    console.log('===============================================');
    console.log('🔬 深入分析：前期跑输指数的根本原因');
    console.log('===============================================\n');

    // 测试不同时间段的表现
    const periods = [
        { name: '前期牛市', start: '20200710', end: '20211231' },
        { name: '中期调整', start: '20220101', end: '20221231' },
        { name: '后期反弹', start: '20230101', end: '20251229' },
        { name: '全周期', start: '20200710', end: '20251229' }
    ];

    const baseParams = {
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
        filterByQuality: true
    };

    for (const period of periods) {
        console.log(`\n📊 ${period.name}（${period.start} - ${period.end}）`);
        console.log('-----------------------------------------------');
        
        try {
            const params = {
                ...baseParams,
                startDate: period.start,
                endDate: period.end
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            
            console.log(`   自定义策略年化: ${customReturn.toFixed(2)}%`);
            console.log(`   指数年化: ${indexReturn.toFixed(2)}%`);
            console.log(`   差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% ${diff > 0 ? '✅' : '❌'}`);
            console.log(`   夏普比率: ${data.customRisk.sharpeRatio.toFixed(4)} vs ${data.indexRisk.sharpeRatio.toFixed(4)}`);
            
        } catch (error) {
            console.error(`   ❌ 错误: ${error.message}`);
        }
    }

    // 测试不同maxWeight的影响
    console.log('\n\n===============================================');
    console.log('🧪 测试不同maxWeight对前期收益的影响');
    console.log('===============================================\n');

    const maxWeights = [0.08, 0.10, 0.13, 0.15, 0.18, 0.20];
    
    for (const mw of maxWeights) {
        try {
            const params = {
                ...baseParams,
                startDate: '20200710',
                endDate: '20211231',
                maxWeight: mw
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            
            console.log(`maxWeight=${(mw*100).toFixed(0)}%: 年化${customReturn.toFixed(2)}% (vs指数${indexReturn.toFixed(2)}%, 差异${diff > 0 ? '+' : ''}${diff.toFixed(2)}%) ${diff > 0 ? '✅' : '❌'}`);
            
        } catch (error) {
            console.error(`   ❌ 错误: ${error.message}`);
        }
    }

    // 测试禁用股票筛选的影响
    console.log('\n\n===============================================');
    console.log('🧪 测试禁用股票筛选的影响');
    console.log('===============================================\n');

    try {
        const params1 = {
            ...baseParams,
            startDate: '20200710',
            endDate: '20211231',
            enableStockFilter: false
        };

        const response1 = await axios.get(`${API_BASE}/index-returns`, { params: params1 });
        const data1 = response1.data.data;
        
        console.log('禁用股票筛选:');
        console.log(`   年化收益: ${(data1.customRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   vs指数: ${(data1.indexRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   差异: ${((data1.customRisk.annualizedReturn - data1.indexRisk.annualizedReturn) * 100).toFixed(2)}%`);
        
    } catch (error) {
        console.error(`   ❌ 错误: ${error.message}`);
    }
}

deepAnalysis();
