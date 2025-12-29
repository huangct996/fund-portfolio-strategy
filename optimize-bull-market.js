const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// 针对前期牛市的优化配置
const bullMarketConfigs = [
    {
        name: '基准配置',
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
        name: '仅动量筛选',
        params: {
            enableStockFilter: true,
            minROE: 0,
            maxDebtRatio: 1,
            momentumMonths: 6,
            minMomentumReturn: -0.15,
            filterByQuality: false
        }
    },
    {
        name: '完全禁用筛选',
        params: {
            enableStockFilter: false
        }
    }
];

async function optimizeBullMarket() {
    console.log('===============================================');
    console.log('🎯 优化前期牛市表现（2020-2021）');
    console.log('===============================================\n');

    const periods = [
        { name: '前期牛市', start: '20200710', end: '20211231' },
        { name: '全周期', start: '20200710', end: '20251229' }
    ];

    let bestConfig = null;
    let bestScore = -Infinity;

    for (const config of bullMarketConfigs) {
        console.log(`\n📊 测试：${config.name}`);
        console.log('-----------------------------------------------');
        
        const results = [];
        
        for (const period of periods) {
            try {
                const params = {
                    strategyType: 'riskParity',
                    useAdaptive: 'true',
                    maxWeight: 0.13,
                    volatilityWindow: 6,
                    ewmaDecay: 0.91,
                    rebalanceFrequency: 'quarterly',
                    enableTradingCost: false,
                    riskFreeRate: 0.02,
                    ...config.params,
                    startDate: period.start,
                    endDate: period.end
                };

                const response = await axios.get(`${API_BASE}/index-returns`, { params });
                const data = response.data.data;
                
                const customReturn = data.customRisk.annualizedReturn * 100;
                const indexReturn = data.indexRisk.annualizedReturn * 100;
                const diff = customReturn - indexReturn;
                const customSharpe = data.customRisk.sharpeRatio;
                
                results.push({
                    period: period.name,
                    customReturn,
                    indexReturn,
                    diff,
                    customSharpe,
                    success: diff > 0
                });
                
                const status = diff > 0 ? '✅' : '❌';
                console.log(`${status} ${period.name}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}% vs 指数${indexReturn.toFixed(2)}%), 夏普${customSharpe.toFixed(4)}`);
                
            } catch (error) {
                console.log(`❌ ${period.name}: 错误 - ${error.message}`);
                results.push({ period: period.name, error: error.message, success: false });
            }
        }
        
        // 计算得分：前期牛市权重70%，全周期权重30%
        const bullResult = results.find(r => r.period === '前期牛市');
        const fullResult = results.find(r => r.period === '全周期');
        
        if (bullResult && !bullResult.error && fullResult && !fullResult.error) {
            const score = bullResult.diff * 0.7 + fullResult.diff * 0.3 + 
                         (bullResult.customSharpe + fullResult.customSharpe) * 5;
            
            console.log(`得分: ${score.toFixed(2)}`);
            
            if (score > bestScore) {
                bestScore = score;
                bestConfig = { config, results, score };
            }
        }
    }

    console.log('\n\n===============================================');
    console.log('🏆 最佳配置（针对前期牛市优化）');
    console.log('===============================================\n');
    console.log(`配置名称: ${bestConfig.config.name}`);
    console.log(`综合得分: ${bestConfig.score.toFixed(2)}`);
    
    console.log('\n详细结果:');
    for (const r of bestConfig.results) {
        if (!r.error) {
            const status = r.success ? '✅' : '❌';
            console.log(`${status} ${r.period}: ${r.diff > 0 ? '+' : ''}${r.diff.toFixed(2)}% (策略${r.customReturn.toFixed(2)}%, 夏普${r.customSharpe.toFixed(4)})`);
        }
    }
    
    console.log('\n最佳参数:');
    console.log(JSON.stringify(bestConfig.config.params, null, 2));
    
    return bestConfig;
}

optimizeBullMarket();
