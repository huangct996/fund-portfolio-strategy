const axios = require('axios');
const dbService = require('./dbService');
require('dotenv').config();

class TushareService {
  constructor() {
    this.token = process.env.TUSHARE_TOKEN;
    this.baseUrl = 'http://api.tushare.pro';
    this.dbInitialized = false;
  }

  async ensureDbInitialized() {
    if (!this.dbInitialized) {
      await dbService.init();
      this.dbInitialized = true;
    }
  }

  /**
   * 调用Tushare API
   */
  async callApi(apiName, params = {}) {
    try {
      const response = await axios.post(this.baseUrl, {
        api_name: apiName,
        token: this.token,
        params: params,
        fields: ''
      });

      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'API调用失败');
      }

      const fields = response.data.data.fields;
      const items = response.data.data.items;

      return items.map(item => {
        const obj = {};
        fields.forEach((field, index) => {
          obj[field] = item[index];
        });
        return obj;
      });
    } catch (error) {
      console.error(`Tushare API错误 (${apiName}):`, error.message);
      throw error;
    }
  }

  /**
   * 获取基金基本信息
   */
  async getFundBasic(fundCode) {
    const data = await this.callApi('fund_basic', {
      ts_code: fundCode
    });
    return data[0];
  }

  /**
   * 获取基金持仓数据（优先从数据库查询）
   */
  async getFundHoldings(fundCode) {
    try {
      await this.ensureDbInitialized();
      
      // 1. 先从数据库查询
      console.log(`正在从数据库查询基金持仓数据: ${fundCode}`);
      let data = await dbService.getFundPortfolio(fundCode);
      
      if (data && data.length > 0) {
        console.log(`✅ 从数据库获取到 ${data.length} 条持仓记录`);
        return data;
      }
      
      // 2. 数据库没有，调用Tushare API
      console.log(`数据库无数据，正在调用Tushare API: ${fundCode}`);
      data = await this.callApi('fund_portfolio', {
        ts_code: fundCode
      });
      console.log(`获取到 ${data.length} 条持仓记录`);
      
      // 3. 保存到数据库
      if (data.length > 0) {
        console.log('正在同步数据到数据库...');
        await dbService.saveFundPortfolio(data);
        console.log('✅ 数据已同步到数据库');
        if (data.length > 0) {
          console.log('示例数据:', data[0]);
        }
      }
      
      return data;
    } catch (error) {
      console.error('获取基金持仓失败:', error.message);
      return [];
    }
  }

  /**
   * 获取基金净值数据（优先从数据库查询）
   */
  async getFundNav(fundCode, startDate = '20180101') {
    await this.ensureDbInitialized();
    
    // 1. 先从数据库查询
    let data = await dbService.getFundNav(fundCode, startDate);
    
    if (data && data.length > 0) {
      console.log(`✅ 从数据库获取到 ${data.length} 条基金净值记录`);
      return data.sort((a, b) => a.nav_date.localeCompare(b.nav_date));
    }
    
    // 2. 数据库没有，调用Tushare API
    console.log(`数据库无净值数据，正在调用Tushare API`);
    data = await this.callApi('fund_nav', {
      ts_code: fundCode,
      start_date: startDate
    });
    
    // 3. 保存到数据库
    if (data.length > 0) {
      await dbService.saveFundNav(data);
      console.log('✅ 净值数据已同步到数据库');
    }
    
    return data.sort((a, b) => a.nav_date.localeCompare(b.nav_date));
  }

  /**
   * 日期加减天数
   */
  addDays(dateStr, days) {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    
    const date = new Date(year, month, day);
    date.setDate(date.getDate() + days);
    
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    
    return `${newYear}${newMonth}${newDay}`;
  }

  /**
   * 批量获取股票基本信息（包含名称、市值、股息率、质量因子，优先从数据库查询）
   */
  async batchGetStockBasic(stockCodes, tradeDate) {
    await this.ensureDbInitialized();
    const results = {};
    
    if (!stockCodes || stockCodes.length === 0) {
      return results;
    }

    // 转换股票代码为ts_code格式
    const tsCodes = stockCodes.map(code => {
      if (code.includes('.')) {
        return code;
      }
      if (code.startsWith('6') || code.startsWith('5')) {
        return `${code}.SH`;
      } else if (code.startsWith('0') || code.startsWith('3')) {
        return `${code}.SZ`;
      }
      return code;
    });

    // 先从数据库查询
    const missingCodes = [];
    for (const tsCode of tsCodes) {
      const dbData = await dbService.getStockBasicInfo(tsCode, tradeDate);
      if (dbData) {
        results[tsCode] = {
          name: dbData.name || tsCode,
          totalMv: parseFloat(dbData.total_mv) || 0,
          dvRatio: parseFloat(dbData.dv_ratio) || 0,
          peTtm: parseFloat(dbData.pe_ttm) || 0,
          pb: parseFloat(dbData.pb) || 0
        };
        
        // 计算质量因子
        const peScore = results[tsCode].peTtm > 0 ? 1 / results[tsCode].peTtm : 0;
        const pbScore = results[tsCode].pb > 0 ? 1 / results[tsCode].pb : 0;
        results[tsCode].qualityFactor = (peScore + pbScore) / 2;
        results[tsCode].peScore = peScore;
        results[tsCode].pbScore = pbScore;
      } else {
        missingCodes.push(tsCode);
      }
    }

    if (missingCodes.length === 0) {
      console.log(`✅ 全部从数据库获取 ${tsCodes.length} 只股票基本信息`);
      return results;
    }

    console.log(`数据库缺失 ${missingCodes.length}/${tsCodes.length} 只股票基本信息，从Tushare获取`);

    // 每次最多获取50只股票
    const batchSize = 50;
    
    // 1. 获取股票名称
    for (let i = 0; i < missingCodes.length; i += batchSize) {
      const batch = missingCodes.slice(i, i + batchSize);
      const tsCodeStr = batch.join(',');
      
      try {
        const data = await this.callApi('stock_basic', {
          ts_code: tsCodeStr
        });

        data.forEach(item => {
          if (!results[item.ts_code]) {
            results[item.ts_code] = {};
          }
          results[item.ts_code].name = item.name;
        });

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(`批量获取股票基本信息失败:`, error.message);
      }
    }

    // 2. 批量获取股票市值、股息率、质量因子
    console.log(`开始批量获取 ${missingCodes.length} 只股票的市值、股息率和质量因子数据...`);
    let successCount = 0;
    const dataToSave = [];
    
    try {
      // 尝试多个日期，找到最接近的交易日
      const datesToTry = [
        tradeDate,
        this.addDays(tradeDate, -1),
        this.addDays(tradeDate, -2),
        this.addDays(tradeDate, -3),
        this.addDays(tradeDate, 1),
        this.addDays(tradeDate, 2),
        this.addDays(tradeDate, 3)
      ];
      
      let allStockData = null;
      let actualTradeDate = null;
      
      for (const date of datesToTry) {
        try {
          console.log(`尝试获取交易日 ${date} 的市值数据...`);
          const data = await this.callApi('daily_basic', {
            trade_date: date,
            fields: 'ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb'
          });
          
          if (data && data.length > 0) {
            console.log(`✅ 获取到 ${data.length} 只股票的数据（交易日: ${date}）`);
            allStockData = data;
            actualTradeDate = date;
            break;
          }
        } catch (error) {
          console.log(`  日期 ${date} 查询失败: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (!allStockData) {
        console.log(`⚠️ 无法找到目标日期 ${tradeDate} 附近的交易日数据`);
      } else {
        // 将数据转换为Map，方便查找
        const dataMap = {};
        allStockData.forEach(item => {
          dataMap[item.ts_code] = item;
        });
        
        // 处理每只需要的股票
        missingCodes.forEach(tsCode => {
          const stockData = dataMap[tsCode];
          
          if (stockData) {
            if (!results[tsCode]) {
              results[tsCode] = {};
            }
            
            results[tsCode].totalMv = parseFloat(stockData.total_mv) || 0;
            results[tsCode].dvRatio = parseFloat(stockData.dv_ratio) || 0;
            results[tsCode].peTtm = parseFloat(stockData.pe_ttm) || 0;
            results[tsCode].pb = parseFloat(stockData.pb) || 0;
            
            // 计算质量因子
            const peScore = results[tsCode].peTtm > 0 ? 1 / results[tsCode].peTtm : 0;
            const pbScore = results[tsCode].pb > 0 ? 1 / results[tsCode].pb : 0;
            results[tsCode].qualityFactor = (peScore + pbScore) / 2;
            results[tsCode].peScore = peScore;
            results[tsCode].pbScore = pbScore;
            
            // 准备保存到数据库
            dataToSave.push({
              ts_code: tsCode,
              name: results[tsCode].name || tsCode,
              trade_date: tradeDate,
              total_mv: results[tsCode].totalMv,
              dv_ratio: results[tsCode].dvRatio,
              pe_ttm: results[tsCode].peTtm,
              pb: results[tsCode].pb
            });
            
            successCount++;
          }
        });
        
        if (actualTradeDate !== tradeDate) {
          console.log(`注意: 使用 ${actualTradeDate} 的数据（目标日期 ${tradeDate} 非交易日）`);
        }
      }
    } catch (error) {
      console.warn(`批量获取市值数据失败:`, error.message);
    }
    
    console.log(`成功获取 ${successCount}/${missingCodes.length} 只股票的完整数据`);
    
    // 保存到数据库
    if (dataToSave.length > 0) {
      await dbService.saveStockBasicInfo(dataToSave);
      console.log('✅ 股票基本信息已同步到数据库');
    }

    return results;
  }

  /**
   * 获取股票日线数据
   */
  async getStockDaily(tsCode, startDate, endDate) {
    const data = await this.callApi('daily', {
      ts_code: tsCode,
      start_date: startDate,
      end_date: endDate
    });
    return data.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  }

  /**
   * 批量获取股票价格（使用前复权价格，优先从数据库查询）
   * 前复权：将历史价格按照分红、配股等因素调整，使价格连续可比
   */
  async batchGetStockPrices(stockCodes, startDate, endDate) {
    await this.ensureDbInitialized();
    const results = {};
    
    if (!stockCodes || stockCodes.length === 0) {
      return results;
    }

    // 转换股票代码为ts_code格式
    const tsCodes = stockCodes.map(code => {
      if (code.includes('.')) {
        return code;
      }
      if (code.startsWith('6') || code.startsWith('5')) {
        return `${code}.SH`;
      } else if (code.startsWith('0') || code.startsWith('3')) {
        return `${code}.SZ`;
      }
      return code;
    });

    // 先尝试从数据库获取，但要验证数据完整性
    const missingCodes = [];
    for (const tsCode of tsCodes) {
      const dailyData = await dbService.getStockDaily(tsCode, startDate, endDate);
      const adjFactorData = await dbService.getAdjFactor(tsCode, startDate, endDate);
      
      // 验证数据完整性：需要同时有日线数据和复权因子，且数量匹配
      if (dailyData.length > 0 && adjFactorData.length > 0 && dailyData.length === adjFactorData.length) {
        // 数据库有完整数据
        const adjFactorMap = {};
        adjFactorData.forEach(item => {
          adjFactorMap[item.trade_date] = item.adj_factor;
        });
        
        // 验证每个交易日都有对应的复权因子
        const hasCompleteData = dailyData.every(item => adjFactorMap[item.trade_date]);
        
        if (hasCompleteData) {
          results[tsCode] = dailyData.map(item => ({
            ts_code: tsCode,
            trade_date: item.trade_date,
            open: item.open_price * (adjFactorMap[item.trade_date] || 1),
            high: item.high_price * (adjFactorMap[item.trade_date] || 1),
            low: item.low_price * (adjFactorMap[item.trade_date] || 1),
            close: item.close_price * (adjFactorMap[item.trade_date] || 1),
            adj_factor: adjFactorMap[item.trade_date] || 1,
            original_close: item.close_price
          })).sort((a, b) => a.trade_date.localeCompare(b.trade_date));
        } else {
          // 数据不完整，需要重新获取
          missingCodes.push(tsCode);
        }
      } else {
        missingCodes.push(tsCode);
      }
    }
    
    if (missingCodes.length > 0) {
      console.log(`数据库缺失 ${missingCodes.length}/${tsCodes.length} 只股票数据，从Tushare获取`);
    } else {
      console.log(`✅ 全部从数据库获取 ${tsCodes.length} 只股票数据`);
      return results;
    }

    // 从Tushare API获取缺失的数据
    const batchSize = 50;
    
    for (let i = 0; i < missingCodes.length; i += batchSize) {
      const batch = missingCodes.slice(i, i + batchSize);
      const tsCodeStr = batch.join(',');
      
      try {
        console.log(`批量获取股票 ${i + 1}-${Math.min(i + batchSize, missingCodes.length)} / ${missingCodes.length}`);
        
        // 获取日线数据
        const dailyData = await this.callApi('daily', {
          ts_code: tsCodeStr,
          start_date: startDate,
          end_date: endDate
        });

        // 获取复权因子
        const adjFactorData = await this.callApi('adj_factor', {
          ts_code: tsCodeStr,
          start_date: startDate,
          end_date: endDate
        });
        
        // 保存到数据库
        if (dailyData.length > 0) {
          await dbService.saveStockDaily(dailyData);
        }
        if (adjFactorData.length > 0) {
          await dbService.saveAdjFactor(adjFactorData);
        }

        // 构建复权因子映射 {ts_code: {trade_date: adj_factor}}
        const adjFactorMap = {};
        adjFactorData.forEach(item => {
          if (!adjFactorMap[item.ts_code]) {
            adjFactorMap[item.ts_code] = {};
          }
          adjFactorMap[item.ts_code][item.trade_date] = item.adj_factor;
        });

        // 按股票代码分组，并应用前复权
        dailyData.forEach(item => {
          const code = item.ts_code;
          const adjFactor = adjFactorMap[code]?.[item.trade_date] || 1;
          
          if (!results[code]) {
            results[code] = [];
          }
          
          // 计算前复权价格：价格 × 复权因子
          results[code].push({
            ...item,
            close: item.close * adjFactor,  // 前复权收盘价
            open: item.open * adjFactor,    // 前复权开盘价
            high: item.high * adjFactor,    // 前复权最高价
            low: item.low * adjFactor,      // 前复权最低价
            adj_factor: adjFactor,          // 保存复权因子
            original_close: item.close      // 保存原始价格
          });
        });

        // 短暂延迟避免API限流
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.warn(`批量获取股票数据失败:`, error.message);
      }
    }

    // 对每只股票的数据按日期排序
    Object.keys(results).forEach(code => {
      results[code].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
    });

    console.log(`成功获取 ${Object.keys(results).length} / ${tsCodes.length} 只股票的数据`);

    return results;
  }
}

module.exports = new TushareService();
