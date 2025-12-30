const axios = require('axios');
const tushareService = require('./services/tushareService');

const API_BASE = 'http://localhost:3001/api';

async function analyzeWeightDistribution() {
    console.log('===============================================');
    console.log('🔍 分析2020-2021年权重分布差异');
    console.log('===============================================\n');

    console.log('关键问题：');
    console.log('既然指数也有10%的maxWeight限制，');
    console.log('为什么风险平价策略（maxWeight=20%）仍然跑输？\n');

    // 获取2020年底的指数权重分布
    const indexCode = '000300.SH';
    const testDate = '20201231';
    
    console.log(`📊 获取${testDate}的指数权重分布...\n`);
    
    try {
        const weights = await tushareService.getIndexWeightByDate(indexCode, testDate);
        
        if (weights && weights.length > 0) {
            // 按权重排序
            weights.sort((a, b) => b.weight - a.weight);
            
            console.log('指数前20大权重股：');
            console.log('-----------------------------------------------');
            for (let i = 0; i < Math.min(20, weights.length); i++) {
                const stock = weights[i];
                console.log(`${i+1}. ${stock.con_code} ${stock.con_name || ''}: ${(stock.weight * 100).toFixed(2)}%`);
            }
            
            // 统计权重分布
            const top10Weight = weights.slice(0, 10).reduce((sum, s) => sum + s.weight, 0);
            const top20Weight = weights.slice(0, 20).reduce((sum, s) => sum + s.weight, 0);
            const top50Weight = weights.slice(0, 50).reduce((sum, s) => sum + s.weight, 0);
            
            console.log('\n权重集中度：');
            console.log(`前10大占比: ${(top10Weight * 100).toFixed(2)}%`);
            console.log(`前20大占比: ${(top20Weight * 100).toFixed(2)}%`);
            console.log(`前50大占比: ${(top50Weight * 100).toFixed(2)}%`);
            
            // 计算平均权重
            const avgWeight = 1 / weights.length;
            console.log(`\n平均权重: ${(avgWeight * 100).toFixed(2)}%`);
            console.log(`总股票数: ${weights.length}`);
        }
    } catch (error) {
        console.error('获取权重数据失败:', error.message);
    }

    // 测试风险平价的实际权重分布
    console.log('\n\n===============================================');
    console.log('🔍 对比风险平价策略的权重分布');
    console.log('===============================================\n');

    console.log('理论分析：');
    console.log('1. 指数权重 = 市值加权（前10大可能占40-50%）');
    console.log('2. 风险平价 = 波动率倒数（更分散，前10大可能只占20-30%）');
    console.log('3. 如果2020-2021年大盘股（高市值、低波动）表现更好');
    console.log('   → 指数会因为高市值权重而跑赢');
    console.log('   → 风险平价会因为低波动权重而跑输\n');

    console.log('关键假设：');
    console.log('2020-2021年可能是"大盘股行情"，而非"龙头股行情"');
    console.log('- 大盘股：市值大、波动小、权重高');
    console.log('- 小盘股：市值小、波动大、权重低');
    console.log('- 风险平价会给小盘股（高波动）更低的权重');
    console.log('- 因此错过了大盘股的收益\n');
}

analyzeWeightDistribution().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
