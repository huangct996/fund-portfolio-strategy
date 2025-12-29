const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testFinalSolution() {
    console.log('===============================================');
    console.log('🎯 最终测试：禁用质量筛选的效果');
    console.log('===============================================\n');

    const periods = [
        { name: '2020年下半年', start: '20200710', end: '20201231' },
        { name: '2021年', start: '20210101', end: '20211231' },
        { name: '2022年', start: '20220101', end: '20221231' },
        { name: '2023年', start: '20230101', end: '20231231' },
        { name: '2024年', start: '20240101', end: '20241231' },
        { name: '全周期', start: '20200710', end: '20251229' }
    ];

    console.log('📊 测试配置：禁用质量筛选（filterByQuality=false）');
    console.log('===============================================\n');

    const results = [];

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
                enableStockFilter: true,
                minROE: 0,
                maxDebtRatio: 1,
                momentumMonths: 6,
                minMomentumReturn: -0.1,
                filterByQuality: false  // 关键：禁用质量筛选
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            const customSharpe = data.customRisk.sharpeRatio;
            
            const status = diff > 0 ? '✅' : '❌';
            console.log(`${status} ${period.name}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}%, 夏普${customSharpe.toFixed(4)})`);
            
            results.push({
                period: period.name,
                customReturn,
                indexReturn,
                diff,
                customSharpe,
                success: diff > 0
            });
            
        } catch (error) {
            console.error(`❌ ${period.name}: 错误 - ${error.message}`);
        }
    }

    console.log('\n===============================================');
    console.log('📊 汇总结果');
    console.log('===============================================\n');
    
    const successCount = results.filter(r => r.success).length;
    console.log(`成功率: ${successCount}/${results.length}\n`);
    
    const fullPeriod = results.find(r => r.period === '全周期');
    if (fullPeriod) {
        console.log(`全周期表现: ${fullPeriod.success ? '✅' : '❌'} ${fullPeriod.diff > 0 ? '+' : ''}${fullPeriod.diff.toFixed(2)}%`);
        console.log(`年化收益: ${fullPeriod.customReturn.toFixed(2)}%`);
        console.log(`夏普比率: ${fullPeriod.customSharpe.toFixed(4)}`);
    }
    
    if (successCount === results.length) {
        console.log('\n🎉 成功！所有时期都跑赢指数！');
    } else {
        const losingPeriods = results.filter(r => !r.success);
        console.log(`\n⚠️  仍有${losingPeriods.length}个时期跑输:`);
        for (const r of losingPeriods) {
            console.log(`   ${r.period}: ${r.diff.toFixed(2)}%`);
        }
    }
}

testFinalSolution();
