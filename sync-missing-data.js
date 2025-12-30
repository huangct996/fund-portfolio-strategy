/**
 * 同步缺失的数据（2025-12-12 至今）
 * 从Tushare API获取数据并保存到数据库
 */

const tushareService = require('./services/tushareService');
const dbService = require('./services/dbService');

async function syncMissingData() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 开始同步缺失的数据');
  console.log('='.repeat(80) + '\n');

  try {
    await dbService.init();
    console.log('✅ 数据库初始化成功\n');

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = '20251212';
    const endDate = todayStr;
    
    console.log(`同步范围: ${startDate} - ${endDate}\n`);
    
    // 1. 同步指数日线数据
    console.log('【步骤1】同步h30269.CSI指数日线数据');
    console.log('-'.repeat(80));
    
    try {
      // 直接调用API，绕过数据库检查
      const indexData = await tushareService.callApi('index_daily', {
        ts_code: 'h30269.CSI',
        start_date: startDate,
        end_date: endDate
      });
      
      console.log(`从Tushare API获取到 ${indexData ? indexData.length : 0} 条指数数据`);
      
      if (indexData && indexData.length > 0) {
        await dbService.saveIndexDaily(indexData);
        console.log('✅ 指数数据已保存到数据库\n');
      } else {
        console.log('⚠️  Tushare API返回空数据\n');
      }
    } catch (error) {
      console.error(`❌ 指数数据同步失败: ${error.message}\n`);
    }
    
    // 2. 同步基金净值数据
    console.log('【步骤2】同步512890.SH基金净值数据');
    console.log('-'.repeat(80));
    
    try {
      // 直接调用API，绕过数据库检查
      const fundData = await tushareService.callApi('fund_nav', {
        ts_code: '512890.SH',
        start_date: startDate,
        end_date: endDate
      });
      
      console.log(`从Tushare API获取到 ${fundData ? fundData.length : 0} 条基金净值数据`);
      
      if (fundData && fundData.length > 0) {
        await dbService.saveFundNav(fundData);
        console.log('✅ 基金净值数据已保存到数据库\n');
      } else {
        console.log('⚠️  Tushare API返回空数据\n');
      }
    } catch (error) {
      console.error(`❌ 基金净值数据同步失败: ${error.message}\n`);
    }
    
    // 3. 同步指数成分股数据
    console.log('【步骤3】同步指数成分股的股票数据');
    console.log('-'.repeat(80));
    
    try {
      // 获取最新的指数成分股
      console.log('获取指数成分股列表...');
      const weights = await tushareService.getIndexWeight('h30269.CSI');
      
      if (weights && weights.length > 0) {
        console.log(`找到 ${weights.length} 只成分股\n`);
        
        const stockCodes = [...new Set(weights.map(w => w.con_code))];
        console.log(`开始同步 ${stockCodes.length} 只股票的数据...`);
        
        // 批量获取股票价格数据
        const priceData = await tushareService.batchGetStockPrices(stockCodes, startDate, endDate);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const code of stockCodes) {
          if (priceData[code] && priceData[code].length > 0) {
            successCount++;
            console.log(`  ✓ ${code}: ${priceData[code].length} 条记录`);
          } else {
            failCount++;
            console.log(`  ✗ ${code}: 无数据`);
          }
        }
        
        console.log(`\n同步完成: 成功 ${successCount} 只, 失败 ${failCount} 只\n`);
      }
    } catch (error) {
      console.error(`❌ 股票数据同步失败: ${error.message}\n`);
    }
    
    // 4. 验证同步结果
    console.log('【步骤4】验证同步结果');
    console.log('-'.repeat(80));
    
    const conn = await dbService.pool.getConnection();
    try {
      // 检查指数数据
      const [indexRows] = await conn.query(
        'SELECT COUNT(*) as count FROM index_daily WHERE ts_code = ? AND trade_date >= ? AND trade_date <= ?',
        ['h30269.CSI', startDate, endDate]
      );
      console.log(`指数数据: ${indexRows[0].count} 条`);
      
      // 检查基金数据
      const [fundRows] = await conn.query(
        'SELECT COUNT(*) as count FROM fund_nav WHERE ts_code = ? AND nav_date >= ? AND nav_date <= ?',
        ['512890.SH', startDate, endDate]
      );
      console.log(`基金数据: ${fundRows[0].count} 条`);
      
      // 检查股票数据（抽样）
      const samples = ['601006.SH', '601088.SH', '600028.SH'];
      for (const code of samples) {
        const [stockRows] = await conn.query(
          'SELECT COUNT(*) as count FROM stock_daily WHERE ts_code = ? AND trade_date >= ? AND trade_date <= ?',
          [code, startDate, endDate]
        );
        console.log(`${code}: ${stockRows[0].count} 条`);
      }
    } finally {
      conn.release();
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 数据同步完成！');
    console.log('='.repeat(80));
    console.log('建议：刷新浏览器页面，重新加载数据查看最新的收益率曲线');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ 同步失败:', error.message);
    console.error(error.stack);
  } finally {
    await dbService.close();
    process.exit(0);
  }
}

syncMissingData().catch(console.error);
