const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function analyzeAllPeriods() {
    console.log('===============================================');
    console.log('🔬 全面分析：逐年对比策略与指数表现');
    console.log('===============================================\n');

    const yearlyPeriods = [
        { name: '2020年下半年', start: '20200710', end: '20201231' },
        { name: '2021年', start: '20210101', end: '20211231' },
        { name: '2022年', start: '20220101', end: '20221231' },
        { name: '2023年', start: '20230101', end: '20231231' },
        { name: '2024年', start: '20240101', end: '20241231' },
        { name: '2025年至今', start: '20250101', end: '20251229' },
        { name: '全周期', start: '20200710', end: '20251229' }
    ];

    const results = [];

    for (const period of yearlyPeriods) {
        console.log(`\n📊 ${period.name}（${period.start} - ${period.end}）`);
        console.log('-----------------------------------------------');
        
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
                filterByQuality: true
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            const customSharpe = data.customRisk.sharpeRatio;
            const indexSharpe = data.indexRisk.sharpeRatio;
            const customDrawdown = data.customRisk.maxDrawdown * 100;
            const indexDrawdown = data.indexRisk.maxDrawdown * 100;
            
            const status = diff > 0 ? '✅' : '❌';
            
            console.log(`${status} 年化收益: 策略${customReturn.toFixed(2)}% vs 指数${indexReturn.toFixed(2)}% (${diff > 0 ? '+' : ''}${diff.toFixed(2)}%)`);
            console.log(`   夏普比率: 策略${customSharpe.toFixed(4)} vs 指数${indexSharpe.toFixed(4)} (${customSharpe > indexSharpe ? '✅' : '❌'})`);
            console.log(`   最大回撤: 策略${customDrawdown.toFixed(2)}% vs 指数${indexDrawdown.toFixed(2)}% (${customDrawdown < indexDrawdown ? '✅' : '❌'})`);
            
            results.push({
                period: period.name,
                customReturn,
                indexReturn,
                diff,
                customSharpe,
                indexSharpe,
                customDrawdown,
                indexDrawdown,
                success: diff > 0
            });
            
        } catch (error) {
            console.error(`❌ 错误: ${error.message}`);
            results.push({
                period: period.name,
                error: error.message,
                success: false
            });
        }
    }

    // 汇总分析
    console.log('\n\n===============================================');
    console.log('📊 汇总分析');
    console.log('===============================================\n');
    
    const successCount = results.filter(r => r.success && !r.error).length;
    const totalCount = results.filter(r => !r.error).length;
    
    console.log(`成功率: ${successCount}/${totalCount}\n`);
    
    console.log('各年度表现:');
    for (const r of results) {
        if (r.error) {
            console.log(`❌ ${r.period}: 测试失败`);
        } else {
            const status = r.success ? '✅' : '❌';
            console.log(`${status} ${r.period}: ${r.diff > 0 ? '+' : ''}${r.diff.toFixed(2)}% (策略${r.customReturn.toFixed(2)}%, 夏普${r.customSharpe.toFixed(4)})`);
        }
    }
    
    // 找出跑输的年份
    const losingPeriods = results.filter(r => !r.error && !r.success);
    if (losingPeriods.length > 0) {
        console.log('\n⚠️  跑输的时期:');
        for (const r of losingPeriods) {
            console.log(`   ${r.period}: ${r.diff.toFixed(2)}% (策略${r.customReturn.toFixed(2)}% vs 指数${r.indexReturn.toFixed(2)}%)`);
        }
    }
    
    return results;
}

analyzeAllPeriods();
