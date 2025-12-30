const marketRegimeService = require('./services/marketRegimeService');
const tushareService = require('./services/tushareService');

async function analyzeRegimeIdentification() {
    console.log('===============================================');
    console.log('🔍 分析2020-2021年市场状态识别');
    console.log('===============================================\n');

    const indexCode = '000300.SH';
    const dates = [
        '20200710',
        '20201001',
        '20210101',
        '20210401',
        '20210701',
        '20211001'
    ];

    for (const date of dates) {
        console.log(`\n📅 ${date}`);
        console.log('-----------------------------------------------');
        
        try {
            // 获取成分股权重
            const weights = await tushareService.getIndexWeightByDate(indexCode, date);
            
            if (!weights || weights.length === 0) {
                console.log('❌ 无成分股数据');
                continue;
            }

            // 识别市场状态
            const baseParams = {
                volatilityWindow: 6,
                ewmaDecay: 0.91,
                momentumMonths: 6,
                minMomentumReturn: -0.1
            };
            
            const regime = await marketRegimeService.identifyMarketRegime(
                indexCode,
                weights,
                date,
                baseParams
            );
            
            console.log(`市场状态: ${regime.regimeName}`);
            console.log(`置信度: ${(regime.confidence * 100).toFixed(0)}%`);
            console.log(`市场宽度: ${(regime.marketBreadth * 100).toFixed(1)}%`);
            console.log(`趋势强度: ${(regime.trendStrength * 100).toFixed(2)}%`);
            console.log(`波动率: ${(regime.volatilityLevel * 100).toFixed(0)}%`);
            console.log(`应用参数:`);
            console.log(`  - maxWeight: ${(regime.params.maxWeight * 100).toFixed(0)}%`);
            console.log(`  - filterByQuality: ${regime.params.filterByQuality}`);
            console.log(`  - hybridRatio: ${(regime.params.hybridRatio * 100).toFixed(0)}%`);
            
            // 判断是否应该是牛市
            if (regime.marketBreadth >= 0.42) {
                console.log('✅ 识别为牛市（市场宽度>=42%）');
            } else {
                console.log('⚠️  未识别为牛市（市场宽度<42%）');
            }
            
        } catch (error) {
            console.error(`❌ 错误: ${error.message}`);
        }
    }
    
    console.log('\n\n===============================================');
    console.log('📊 分析结论');
    console.log('===============================================\n');
    console.log('如果2020-2021年大部分时期未被识别为牛市，');
    console.log('说明市场宽度阈值设置过高，需要降低。');
    console.log('\n当前阈值：');
    console.log('  - 强势牛市：市场宽度>=52%');
    console.log('  - 温和牛市：市场宽度>=42%');
    console.log('\n建议：如果大部分时期市场宽度在30-40%之间，');
    console.log('应该降低牛市阈值到35%左右。');
}

analyzeRegimeIdentification().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
