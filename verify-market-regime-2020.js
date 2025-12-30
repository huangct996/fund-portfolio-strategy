const marketRegimeService = require('./services/marketRegimeService');
const tushareService = require('./services/tushareService');

async function verifyMarketRegime2020() {
    console.log('===============================================');
    console.log('🔍 验证2020-2021年市场状态识别');
    console.log('===============================================\n');

    const indexCode = '000300.SH';
    
    // 测试关键日期
    const testDates = [
        { date: '20200630', desc: '2020年中' },
        { date: '20201231', desc: '2020年底' },
        { date: '20210630', desc: '2021年中' },
        { date: '20211231', desc: '2021年底' }
    ];

    for (const { date, desc } of testDates) {
        console.log(`\n📅 ${desc} (${date})`);
        console.log('-----------------------------------------------');
        
        try {
            // 获取成分股权重
            const weights = await tushareService.getIndexWeightByDate(indexCode, date);
            
            if (!weights || weights.length === 0) {
                console.log('❌ 无成分股数据\n');
                continue;
            }
            
            console.log(`✅ 成分股数量: ${weights.length}`);
            
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
            
            console.log(`\n市场状态: ${regime.regimeName}`);
            console.log(`置信度: ${(regime.confidence * 100).toFixed(0)}%`);
            console.log(`市场宽度: ${(regime.marketBreadth * 100).toFixed(1)}%`);
            console.log(`趋势强度: ${(regime.trendStrength * 100).toFixed(2)}%`);
            console.log(`波动率水平: ${(regime.volatilityLevel * 100).toFixed(0)}%`);
            
            console.log(`\n应用的参数:`);
            console.log(`  maxWeight: ${(regime.params.maxWeight * 100).toFixed(0)}%`);
            console.log(`  hybridRatio: ${(regime.params.hybridRatio * 100).toFixed(0)}%`);
            console.log(`  filterByQuality: ${regime.params.filterByQuality}`);
            console.log(`  enableStockFilter: ${regime.params.enableStockFilter}`);
            
            // 判断是否为牛市
            const isBull = regime.regimeName.includes('BULL');
            if (isBull) {
                console.log(`\n✅ 识别为牛市 - maxWeight=${(regime.params.maxWeight * 100).toFixed(0)}%, 应该更激进`);
            } else {
                console.log(`\n⚠️  未识别为牛市 - 使用保守参数`);
            }
            
        } catch (error) {
            console.error(`❌ 错误: ${error.message}\n`);
        }
    }
    
    console.log('\n\n===============================================');
    console.log('📊 总结');
    console.log('===============================================\n');
    console.log('关键问题：');
    console.log('1. 2020-2021年是否被识别为牛市？');
    console.log('2. 如果是牛市，maxWeight是否足够激进（>=18%）？');
    console.log('3. 如果不是牛市，市场宽度阈值是否需要调整？\n');
    console.log('当前阈值：');
    console.log('  - 强势牛市：市场宽度>=52%');
    console.log('  - 温和牛市：市场宽度>=42%');
    console.log('  - 震荡市场：市场宽度32-42%');
    console.log('  - 弱势市场：市场宽度<32%\n');
}

verifyMarketRegime2020().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
