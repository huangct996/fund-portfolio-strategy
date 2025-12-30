const tushareService = require('./services/tushareService');
const dbService = require('./services/dbService');

async function sync2020_2021Weights() {
    console.log('===============================================');
    console.log('🔄 同步2020-2021年成分股权重数据');
    console.log('===============================================\n');

    // 初始化数据库连接
    await dbService.init();
    
    const indexCode = '000300.SH';
    
    // 需要同步的日期（年度调仓日期）
    const dates = [
        '20191231',  // 2019年底（作为2020年初的数据）
        '20200630',  // 2020年中
        '20201231',  // 2020年底
        '20210630',  // 2021年中
        '20211231'   // 2021年底
    ];

    console.log('尝试从Tushare API获取成分股权重数据...\n');

    for (const date of dates) {
        try {
            console.log(`📅 ${date}:`);
            
            // 调用Tushare API获取成分股权重
            const data = await tushareService.callApi('index_weight', {
                index_code: indexCode,
                trade_date: date
            });
            
            if (data && data.length > 0) {
                console.log(`   ✅ 获取到 ${data.length} 只成分股`);
                
                // 转换数据格式并保存到数据库
                const weightData = data.map(item => ({
                    index_code: indexCode,
                    con_code: item.con_code,
                    trade_date: date,
                    weight: item.weight / 100  // Tushare返回的是百分比，需要转换为小数
                }));
                
                await dbService.saveIndexWeight(weightData);
                
                console.log(`   💾 已保存到数据库\n`);
            } else {
                console.log(`   ⚠️  该日期无数据\n`);
            }
            
            // 避免API频率限制
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } catch (error) {
            console.error(`   ❌ 错误: ${error.message}\n`);
        }
    }

    console.log('\n===============================================');
    console.log('🔍 验证同步结果');
    console.log('===============================================\n');

    // 验证数据是否成功同步
    for (const date of dates) {
        try {
            const weights = await tushareService.getIndexWeightByDate(indexCode, date);
            if (weights && weights.length > 0) {
                console.log(`✅ ${date}: ${weights.length}只股票`);
            } else {
                console.log(`❌ ${date}: 无数据`);
            }
        } catch (error) {
            console.log(`❌ ${date}: 错误`);
        }
    }

    console.log('\n===============================================');
    console.log('📊 下一步');
    console.log('===============================================\n');
    console.log('数据同步完成后，重新运行回测：');
    console.log('1. 自适应策略将能够识别2020-2021年的市场状态');
    console.log('2. 根据市场状态动态调整参数');
    console.log('3. 验证是否能改善前期表现\n');
}

sync2020_2021Weights().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
