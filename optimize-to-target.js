const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// 测试配置
const testConfigs = [
    {
        name: '当前配置（禁用筛选）',
        params: {
            strategyType: 'riskParity',
            useAdaptive: 'true',
            maxWeight: 0.13,
            volatilityWindow: 6,
            ewmaDecay: 0.91,
            rebalanceFrequency: 'quarterly',
            enableTradingCost: false,
            riskFreeRate: 0.02,
            enableStockFilter: false
        }
    },
    {
        name: '启用筛选+激进配置',
        params: {
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
        }
    },
    {
        name: '更激进筛选',
        params: {
            strategyType: 'riskParity',
            useAdaptive: 'true',
            maxWeight: 0.13,
            volatilityWindow: 6,
            ewmaDecay: 0.91,
            rebalanceFrequency: 'quarterly',
            enableTradingCost: false,
            riskFreeRate: 0.02,
            enableStockFilter: true,
            minROE: 0.08,
            maxDebtRatio: 0.6,
            momentumMonths: 6,
            minMomentumReturn: 0,
            filterByQuality: true
        }
    },
    {
        name: '动量优选策略',
        params: {
            strategyType: 'riskParity',
            useAdaptive: 'true',
            maxWeight: 0.13,
            volatilityWindow: 6,
            ewmaDecay: 0.91,
            rebalanceFrequency: 'quarterly',
            enableTradingCost: false,
            riskFreeRate: 0.02,
            enableStockFilter: true,
            minROE: 0.05,
            maxDebtRatio: 0.8,
            momentumMonths: 3,
            minMomentumReturn: 0.05,
            filterByQuality: true
        }
    }
];

async function testConfig(config, periods) {
    const results = [];
    
    for (const period of periods) {
        try {
            const params = {
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
            const indexSharpe = data.indexRisk.sharpeRatio;
            
            results.push({
                period: period.name,
                customReturn,
                indexReturn,
                diff,
                customSharpe,
                indexSharpe,
                success: diff > 0
            });
        } catch (error) {
            results.push({
                period: period.name,
                error: error.message,
                success: false
            });
        }
    }
    
    return results;
}

async function optimizeToTarget() {
    console.log('===============================================');
    console.log('🎯 自动优化：全阶段跑赢指数 + 最大化夏普比率');
    console.log('===============================================\n');

    const periods = [
        { name: '前期牛市', start: '20200710', end: '20211231' },
        { name: '中期调整', start: '20220101', end: '20221231' },
        { name: '后期反弹', start: '20230101', end: '20251229' },
        { name: '全周期', start: '20200710', end: '20251229' }
    ];

    let bestConfig = null;
    let bestScore = -Infinity;

    for (const config of testConfigs) {
        console.log(`\n📊 测试配置：${config.name}`);
        console.log('-----------------------------------------------');
        
        const results = await testConfig(config, periods);
        
        // 计算综合得分
        let totalDiff = 0;
        let totalSharpe = 0;
        let successCount = 0;
        
        for (const r of results) {
            if (r.error) {
                console.log(`❌ ${r.period}: 错误 - ${r.error}`);
            } else {
                const status = r.success ? '✅' : '❌';
                console.log(`${status} ${r.period}: ${r.diff > 0 ? '+' : ''}${r.diff.toFixed(2)}% (策略${r.customReturn.toFixed(2)}% vs 指数${r.indexReturn.toFixed(2)}%), 夏普${r.customSharpe.toFixed(4)}`);
                
                totalDiff += r.diff;
                totalSharpe += r.customSharpe;
                if (r.success) successCount++;
            }
        }
        
        const avgDiff = totalDiff / results.length;
        const avgSharpe = totalSharpe / results.length;
        
        // 综合得分：收益差异 + 夏普比率 + 成功率奖励
        const score = avgDiff * 0.4 + avgSharpe * 10 + successCount * 2;
        
        console.log(`\n📈 综合评分: ${score.toFixed(2)} (平均差异${avgDiff.toFixed(2)}%, 平均夏普${avgSharpe.toFixed(4)}, 成功率${successCount}/${results.length})`);
        
        if (score > bestScore) {
            bestScore = score;
            bestConfig = { config, results, score, avgDiff, avgSharpe, successCount };
        }
    }

    console.log('\n\n===============================================');
    console.log('🏆 最佳配置');
    console.log('===============================================\n');
    console.log(`配置名称: ${bestConfig.config.name}`);
    console.log(`综合得分: ${bestConfig.score.toFixed(2)}`);
    console.log(`平均收益差异: ${bestConfig.avgDiff > 0 ? '+' : ''}${bestConfig.avgDiff.toFixed(2)}%`);
    console.log(`平均夏普比率: ${bestConfig.avgSharpe.toFixed(4)}`);
    console.log(`成功率: ${bestConfig.successCount}/${periods.length}`);
    
    console.log('\n详细结果:');
    for (const r of bestConfig.results) {
        if (!r.error) {
            const status = r.success ? '✅' : '❌';
            console.log(`${status} ${r.period}: ${r.diff > 0 ? '+' : ''}${r.diff.toFixed(2)}% (夏普${r.customSharpe.toFixed(4)})`);
        }
    }
    
    console.log('\n最佳参数:');
    console.log(JSON.stringify(bestConfig.config.params, null, 2));
    
    return bestConfig;
}

optimizeToTarget();
