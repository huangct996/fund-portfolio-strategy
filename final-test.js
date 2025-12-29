const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function finalTest() {
    console.log('===============================================');
    console.log('🎯 最终测试：验证全阶段跑赢指数');
    console.log('===============================================\n');

    const testPeriods = [
        { name: '前期牛市', start: '20200710', end: '20211231', target: '跑赢指数' },
        { name: '中期调整', start: '20220101', end: '20221231', target: '跑赢指数' },
        { name: '后期反弹', start: '20230101', end: '20251229', target: '跑赢指数' },
        { name: '全周期', start: '20200710', end: '20251229', target: '跑赢指数' }
    ];

    const results = [];

    for (const period of testPeriods) {
        console.log(`\n📊 测试：${period.name}（${period.start} - ${period.end}）`);
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
                enableStockFilter: false  // 禁用股票筛选
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            
            const customSharpe = data.customRisk.sharpeRatio;
            const indexSharpe = data.indexRisk.sharpeRatio;
            
            const success = diff > 0;
            
            console.log(`策略年化收益: ${customReturn.toFixed(2)}%`);
            console.log(`指数年化收益: ${indexReturn.toFixed(2)}%`);
            console.log(`收益差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% ${success ? '✅' : '❌'}`);
            console.log(`策略夏普比率: ${customSharpe.toFixed(4)}`);
            console.log(`指数夏普比率: ${indexSharpe.toFixed(4)}`);
            console.log(`夏普差异: ${(customSharpe - indexSharpe > 0 ? '+' : '')}${(customSharpe - indexSharpe).toFixed(4)} ${customSharpe > indexSharpe ? '✅' : '❌'}`);
            
            results.push({
                period: period.name,
                customReturn,
                indexReturn,
                diff,
                customSharpe,
                indexSharpe,
                success
            });
            
        } catch (error) {
            console.error(`❌ 错误: ${error.message}`);
            results.push({
                period: period.name,
                success: false,
                error: error.message
            });
        }
    }

    // 汇总结果
    console.log('\n\n===============================================');
    console.log('📊 测试结果汇总');
    console.log('===============================================\n');
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`成功: ${successCount}/${totalCount}\n`);
    
    results.forEach(r => {
        if (r.error) {
            console.log(`❌ ${r.period}: 测试失败 - ${r.error}`);
        } else {
            console.log(`${r.success ? '✅' : '❌'} ${r.period}: ${r.diff > 0 ? '+' : ''}${r.diff.toFixed(2)}% (策略${r.customReturn.toFixed(2)}% vs 指数${r.indexReturn.toFixed(2)}%)`);
        }
    });
    
    console.log('\n===============================================');
    if (successCount === totalCount) {
        console.log('🎉 所有测试通过！策略全阶段跑赢指数！');
    } else {
        console.log(`⚠️  ${totalCount - successCount}个测试未通过，需要继续优化`);
    }
    console.log('===============================================\n');
}

finalTest();
