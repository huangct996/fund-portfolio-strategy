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
   * 批量获取股票基本信息（包含名称和市值）
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

    // 2. 获取股票市值（逐个获取以避免权限问题）
    console.log(`开始获取 ${tsCodes.length} 只股票的市值数据...`);
    let successCount = 0;
    
    for (let i = 0; i < tsCodes.length; i++) {
      const tsCode = tsCodes[i];
      
      try {
        const data = await this.callApi('daily_basic', {
          ts_code: tsCode,
          trade_date: tradeDate,
          fields: 'ts_code,trade_date,total_mv'
        });

        if (data && data.length > 0) {
          if (!results[tsCode]) {
            results[tsCode] = {};
          }
          results[tsCode].totalMv = data[0].total_mv || 0;  // 总市值（万元）
          successCount++;
        }

        // 每10个请求延迟一下
        if ((i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
      } catch (error) {
        console.warn(`获取 ${tsCode} 市值失败:`, error.message);
      }
    }
    
    console.log(`成功获取 ${successCount}/${tsCodes.length} 只股票的市值数据`);

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
   * 批量获取股票价格（使用逗号分隔一次性获取多个股票）
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

    // 每次最多获取50只股票
    const batchSize = 50;
    
    for (let i = 0; i < tsCodes.length; i += batchSize) {
      const batch = tsCodes.slice(i, i + batchSize);
      const tsCodeStr = batch.join(',');
      
      try {
        console.log(`批量获取股票 ${i + 1}-${Math.min(i + batchSize, tsCodes.length)} / ${tsCodes.length}`);
        
        const data = await this.callApi('daily', {
          ts_code: tsCodeStr,
          start_date: startDate,
          end_date: endDate
        });

        // 按股票代码分组
        data.forEach(item => {
          const code = item.ts_code;
          if (!results[code]) {
            results[code] = [];
          }
          results[code].push(item);
        });

        // 短暂延迟避免API限流
        await new Promise(resolve => setTimeout(resolve, 200));
        
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
