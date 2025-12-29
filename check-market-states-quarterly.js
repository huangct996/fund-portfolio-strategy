const marketRegimeService = require('./services/marketRegimeService');

async function checkMarketStates() {
    
    // 季度调仓日期（2020-2025）
    const quarterlyDates = [
        '20200930', '20201231',
        '20210331', '20210630', '20210930', '20211231',
        '20220331', '20220630', '20220930', '20221230',
        '20230331', '20230630', '20230929', '20231229',
        '20240329', '20240628', '20240930', '20241231'
    ];
    
    console.log('===============================================');
    console.log('🔬 检查季度调仓期的市场状态识别');
    console.log('===============================================\n');
    
    for (const date of quarterlyDates) {
        try {
            const regime = await marketRegimeService.getMarketRegime('h30269.CSI', date);
            
            console.log(`${date}: ${regime.regimeName}`);
            console.log(`  市场宽度: ${regime.indicators.marketBreadth !== null ? (regime.indicators.marketBreadth * 100).toFixed(1) + '%' : 'N/A'}`);
            console.log(`  参数: maxWeight=${(regime.params.maxWeight * 100).toFixed(0)}%, ` +
                `ewmaDecay=${regime.params.ewmaDecay.toFixed(2)}, ` +
                `volatilityWindow=${regime.params.volatilityWindow}月`);
            console.log(`  股票池: minROE=${(regime.params.minROE * 100).toFixed(0)}%, ` +
                `momentum=${regime.params.momentumMonths}月, ` +
                `minReturn=${(regime.params.minMomentumReturn * 100).toFixed(0)}%\n`);
        } catch (error) {
            console.log(`${date}: 错误 - ${error.message}\n`);
        }
    }
    
    console.log('===============================================');
    console.log('✅ 检查完成！');
    console.log('===============================================');
}

checkMarketStates();
