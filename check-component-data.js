const tushareService = require('./services/tushareService');

async function checkComponentData() {
    console.log('===============================================');
    console.log('🔍 检查2020-2021年成分股数据是否存在');
    console.log('===============================================\n');

    const indexCode = '000300.SH';
    
    // 2020-2021年的季度调仓日期
    const dates = [
        '20200710',  // 起始日期
        '20201001',  // 2020Q4
        '20210101',  // 2021Q1
        '20210401',  // 2021Q2
        '20210701',  // 2021Q3
        '20211001',  // 2021Q4
        '20211231'   // 结束日期
    ];

    console.log('检查这些日期的成分股数据：\n');

    let hasDataCount = 0;
    let noDataCount = 0;

    for (const date of dates) {
        try {
            const weights = await tushareService.getIndexWeightByDate(indexCode, date);
            
            if (weights && weights.length > 0) {
                console.log(`✅ ${date}: 有数据 (${weights.length}只股票)`);
                hasDataCount++;
            } else {
                console.log(`❌ ${date}: 无数据`);
                noDataCount++;
            }
        } catch (error) {
            console.log(`❌ ${date}: 错误 - ${error.message}`);
            noDataCount++;
        }
    }

    console.log('\n===============================================');
    console.log('📊 统计');
    console.log('===============================================\n');
    console.log(`有数据: ${hasDataCount}个日期`);
    console.log(`无数据: ${noDataCount}个日期`);
    
    if (noDataCount > hasDataCount) {
        console.log('\n⚠️  关键发现：');
        console.log('大部分调仓日期都没有成分股数据！');
        console.log('这意味着自适应策略在2020-2021年大部分时间无法运行。');
        console.log('\n原因分析：');
        console.log('1. 如果tempWeights为空，代码会跳过市场状态识别');
        console.log('2. effectiveRiskParityParams = riskParityParams（使用固定参数）');
        console.log('3. 实际上退化成了固定的风险平价策略');
        console.log('\n这就是为什么：');
        console.log('- 启用/禁用自适应收益接近（12.18% vs 12.59%）');
        console.log('- maxWeight调整无效（都是12.59%）');
        console.log('- 看起来像"风险平价的固有特性"');
        console.log('\n但实际上：');
        console.log('自适应策略根本没有在2020-2021年运行！');
    } else {
        console.log('\n✅ 大部分日期都有成分股数据');
        console.log('自适应策略应该能正常运行');
        console.log('需要进一步检查市场状态识别结果');
    }
}

checkComponentData().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
