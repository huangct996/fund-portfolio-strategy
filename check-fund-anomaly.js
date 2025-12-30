/**
 * 检查2021-10-22基金净值异常问题
 */

const dbService = require('./services/dbService');
const tushareService = require('./services/tushareService');

async function checkFundAnomaly() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 检查512890.SH基金净值异常（2021-10-22）');
  console.log('='.repeat(80) + '\n');

  try {
    await dbService.init();
    console.log('✅ 数据库初始化成功\n');

    const fundCode = '512890.SH';
    const startDate = '20211015';  // 异常日期前一周
    const endDate = '20211029';    // 异常日期后一周
    
    // 1. 从数据库查询
    console.log('【步骤1】从数据库查询基金净值数据');
    console.log('-'.repeat(80));
    console.log(`查询范围: ${startDate} - ${endDate}\n`);
    
    const dbData = await dbService.getFundNav(fundCode, startDate, endDate);
    console.log(`数据库中找到 ${dbData.length} 条记录\n`);
    
    if (dbData.length > 0) {
      console.log('详细数据:');
      console.log('日期\t\t单位净值\t累计净值\t日收益率');
      console.log('-'.repeat(80));
      
      let prevNav = null;
      dbData.forEach((item, index) => {
        const dailyReturn = prevNav ? ((item.unit_nav - prevNav) / prevNav * 100).toFixed(2) : '0.00';
        console.log(`${item.nav_date}\t${item.unit_nav}\t\t${item.accum_nav}\t\t${dailyReturn}%`);
        
        // 标记异常数据
        if (Math.abs(parseFloat(dailyReturn)) > 10) {
          console.log(`  ⚠️  异常！单日收益率 ${dailyReturn}%`);
        }
        
        prevNav = item.unit_nav;
      });
    }
    
    // 2. 从Tushare API查询
    console.log('\n【步骤2】从Tushare API查询基金净值数据');
    console.log('-'.repeat(80));
    
    const apiData = await tushareService.callApi('fund_nav', {
      ts_code: fundCode,
      start_date: startDate,
      end_date: endDate
    });
    
    console.log(`Tushare API返回 ${apiData ? apiData.length : 0} 条记录\n`);
    
    if (apiData && apiData.length > 0) {
      const sortedData = apiData.sort((a, b) => a.nav_date.localeCompare(b.nav_date));
      
      console.log('详细数据:');
      console.log('日期\t\t单位净值\t累计净值\t日收益率');
      console.log('-'.repeat(80));
      
      let prevNav = null;
      sortedData.forEach((item, index) => {
        const dailyReturn = prevNav ? ((item.unit_nav - prevNav) / prevNav * 100).toFixed(2) : '0.00';
        console.log(`${item.nav_date}\t${item.unit_nav}\t\t${item.accum_nav}\t\t${dailyReturn}%`);
        
        // 标记异常数据
        if (Math.abs(parseFloat(dailyReturn)) > 10) {
          console.log(`  ⚠️  异常！单日收益率 ${dailyReturn}%`);
        }
        
        prevNav = item.unit_nav;
      });
    }
    
    // 3. 检查是否有分红数据
    console.log('\n【步骤3】检查基金分红数据');
    console.log('-'.repeat(80));
    
    try {
      const divData = await tushareService.callApi('fund_div', {
        ts_code: fundCode,
        ex_date: '20211022'  // 除权除息日
      });
      
      if (divData && divData.length > 0) {
        console.log('找到分红数据:');
        divData.forEach(div => {
          console.log(`  除权日: ${div.ex_date}`);
          console.log(`  分红金额: ${div.div_cash || 0} 元/份`);
          console.log(`  拆分比例: ${div.split_ratio || 1}`);
        });
      } else {
        console.log('未找到分红数据');
      }
    } catch (error) {
      console.log(`查询分红数据失败: ${error.message}`);
    }
    
    // 4. 分析结论
    console.log('\n' + '='.repeat(80));
    console.log('📋 分析结论:');
    console.log('='.repeat(80));
    console.log('1. 如果单位净值突然下降但累计净值不变 → 可能是分红除权');
    console.log('2. 如果单位净值和累计净值都异常 → 可能是数据错误');
    console.log('3. 如果有分红数据 → 需要使用累计净值计算收益率');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error(error.stack);
  } finally {
    await dbService.close();
    process.exit(0);
  }
}

checkFundAnomaly().catch(console.error);
