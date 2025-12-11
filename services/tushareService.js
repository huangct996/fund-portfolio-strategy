const axios = require('axios');
require('dotenv').config();

class TushareService {
  constructor() {
    this.token = process.env.TUSHARE_TOKEN;
    this.baseUrl = 'http://api.tushare.pro';
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
   * 获取基金持仓数据
   */
  async getFundHoldings(fundCode) {
    try {
      console.log(`正在获取基金持仓数据: ${fundCode}`);
      const data = await this.callApi('fund_portfolio', {
        ts_code: fundCode
      });
      console.log(`获取到 ${data.length} 条持仓记录`);
      if (data.length > 0) {
        console.log('示例数据:', data[0]);
      }
      return data;
    } catch (error) {
      console.error('获取基金持仓失败:', error.message);
      return [];
    }
  }

  /**
   * 获取基金净值数据
   */
  async getFundNav(fundCode, startDate = '20180101') {
    const data = await this.callApi('fund_nav', {
      ts_code: fundCode,
      start_date: startDate
    });
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
   * 批量获取股票基本信息（包含名称、市值、股息率、质量因子）
   */
  async batchGetStockBasic(stockCodes, tradeDate) {
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

    // 每次最多获取50只股票
    const batchSize = 50;
    
    // 1. 获取股票名称
    for (let i = 0; i < tsCodes.length; i += batchSize) {
      const batch = tsCodes.slice(i, i + batchSize);
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

    // 2. 获取股票市值、股息率、质量因子（逐个获取以避免权限问题）
    console.log(`开始获取 ${tsCodes.length} 只股票的市值、股息率和质量因子数据...`);
    let successCount = 0;
    
    for (let i = 0; i < tsCodes.length; i++) {
      const tsCode = tsCodes[i];
      
      try {
        // 获取市值、股息率、PE、PB
        // 注意：如果tradeDate不是交易日，需要查找前后最近的交易日
        let data = await this.callApi('daily_basic', {
          ts_code: tsCode,
          trade_date: tradeDate,
          fields: 'ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb'
        });
        
        // 如果指定日期没有数据，尝试获取该日期前后一周的数据
        if (!data || data.length === 0) {
          const startDate = this.addDays(tradeDate, -7);
          const endDate = this.addDays(tradeDate, 7);
          
          data = await this.callApi('daily_basic', {
            ts_code: tsCode,
            start_date: startDate,
            end_date: endDate,
            fields: 'ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb'
          });
          
          // 选择最接近目标日期的数据
          if (data && data.length > 0) {
            data = [data.reduce((closest, item) => {
              const closestDiff = Math.abs(parseInt(closest.trade_date) - parseInt(tradeDate));
              const itemDiff = Math.abs(parseInt(item.trade_date) - parseInt(tradeDate));
              return itemDiff < closestDiff ? item : closest;
            })];
          }
        }

        if (data && data.length > 0) {
          if (!results[tsCode]) {
            results[tsCode] = {};
          }
          
          const actualDate = data[0].trade_date;
          if (actualDate !== tradeDate) {
            console.log(`  ${tsCode}: 使用 ${actualDate} 的数据（目标日期 ${tradeDate} 非交易日）`);
          }
          
          results[tsCode].totalMv = data[0].total_mv || 0;  // 总市值（万元）
          results[tsCode].dvRatio = data[0].dv_ratio || 0;  // 股息率（%）
          results[tsCode].peTtm = data[0].pe_ttm || 0;      // 市盈率TTM
          results[tsCode].pb = data[0].pb || 0;              // 市净率
          
          // 默认质量因子：PE+PB综合
          const peScore = data[0].pe_ttm > 0 ? 1 / data[0].pe_ttm : 0;
          const pbScore = data[0].pb > 0 ? 1 / data[0].pb : 0;
          results[tsCode].qualityFactor = (peScore + pbScore) / 2;
          results[tsCode].peScore = peScore;
          results[tsCode].pbScore = pbScore;
          
          successCount++;
        } else {
          console.warn(`  ${tsCode}: 无法获取市值数据（目标日期 ${tradeDate} 前后一周无交易数据）`);
        }
        
        // 尝试获取ROE数据（财务指标）
        try {
          const finData = await this.callApi('fina_indicator', {
            ts_code: tsCode,
            period: tradeDate.substring(0, 6) + '31',  // 转换为季度末日期
            fields: 'ts_code,end_date,roe'
          });
          
          if (finData && finData.length > 0 && results[tsCode]) {
            results[tsCode].roe = finData[0].roe || 0;  // ROE（%）
          }
        } catch (error) {
          // ROE数据获取失败不影响主流程
        }

        // 每10个请求延迟一下
        if ((i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
      } catch (error) {
        console.warn(`获取 ${tsCode} 数据失败:`, error.message);
      }
    }
    
    console.log(`成功获取 ${successCount}/${tsCodes.length} 只股票的完整数据`);

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
   * 批量获取股票价格（使用前复权价格）
   * 前复权：将历史价格按照分红、配股等因素调整，使价格连续可比
   */
  async batchGetStockPrices(stockCodes, startDate, endDate) {
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

    // 由于需要获取复权因子，只能逐个股票获取
    // 每次最多获取50只股票的数据和复权因子
    const batchSize = 50;
    
    for (let i = 0; i < tsCodes.length; i += batchSize) {
      const batch = tsCodes.slice(i, i + batchSize);
      const tsCodeStr = batch.join(',');
      
      try {
        console.log(`批量获取股票 ${i + 1}-${Math.min(i + batchSize, tsCodes.length)} / ${tsCodes.length}`);
        
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
