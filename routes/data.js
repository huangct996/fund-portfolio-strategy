const express = require('express');
const router = express.Router();
const tushareService = require('../services/tushareService');
const portfolioService = require('../services/portfolioService');
const indexPortfolioService = require('../services/indexPortfolioService');
const dbService = require('../services/dbService');

const FUND_CODE = process.env.FUND_CODE || '512890.SH';
const INDEX_CODE = process.env.INDEX_CODE || 'h30269.CSI';
const MAX_WEIGHT = parseFloat(process.env.MAX_WEIGHT) || 0.10;

/**
 * 获取基金基本信息
 */
router.get('/fund-info', async (req, res) => {
  try {
    const fundInfo = await tushareService.getFundBasic(FUND_CODE);
    res.json({
      success: true,
      data: fundInfo
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取指数的所有调仓日期
 */
router.get('/rebalance-dates', async (req, res) => {
  try {
    const dates = await tushareService.getIndexWeightDates(INDEX_CODE);
    
    res.json({
      success: true,
      data: {
        dates: dates,
        indexCode: INDEX_CODE,
        firstDate: dates.length > 0 ? dates[0] : null,
        lastDate: dates.length > 0 ? dates[dates.length - 1] : null,
        totalCount: dates.length
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 计算基于指数成分股的回测收益率
 * 查询参数:
 * - useCompositeScore: 是否使用综合得分策略，true/false
 * - mvWeight: 市值权重，0-1之间
 * - dvWeight: 股息率权重，0-1之间
 * - qualityWeight: 质量因子权重，0-1之间
 * - qualityFactorType: 质量因子类型
 * - maxWeight: 单只股票最大权重
 */
router.get('/index-returns', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      useCompositeScore,
      mvWeight,
      dvWeight,
      qualityWeight,
      qualityFactorType,
      maxWeight
    } = req.query;
    
    // 使用用户配置的maxWeight，如果没有则使用环境变量的默认值
    const effectiveMaxWeight = maxWeight ? parseFloat(maxWeight) : MAX_WEIGHT;
    
    // 设置indexPortfolioService的maxWeight
    indexPortfolioService.maxWeight = effectiveMaxWeight;
    
    const config = {
      startDate: startDate || '',
      endDate: endDate || '',
      useCompositeScore: useCompositeScore === 'true',
      scoreWeights: {
        mvWeight: parseFloat(mvWeight) || 0.5,
        dvWeight: parseFloat(dvWeight) || 0.3,
        qualityWeight: parseFloat(qualityWeight) || 0.2
      },
      qualityFactorType: qualityFactorType || 'pe_pb'
    };
    
    const result = await indexPortfolioService.calculateIndexBasedReturns(
      INDEX_CODE,
      FUND_CODE,
      config
    );
    
    res.json({
      success: true,
      data: {
        periods: result.periods || [],
        customRisk: result.customRisk || null,
        indexRisk: result.indexRisk || null,
        fundRisk: result.fundRisk || null,
        trackingError: result.trackingError || null,
        indexCode: INDEX_CODE,
        fundCode: FUND_CODE,
        config: config
      }
    });
  } catch (error) {
    console.error('计算指数回测收益率失败:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 查询指定日期的指数成分股
 * 查询参数:
 * - date: 调仓日期，格式YYYYMMDD
 */
router.get('/index-constituents', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.json({
        success: false,
        error: '请提供调仓日期参数'
      });
    }
    
    // 获取指定日期的指数成分股权重
    const constituents = await tushareService.getIndexWeightByDate(INDEX_CODE, date);
    
    if (!constituents || constituents.length === 0) {
      return res.json({
        success: false,
        error: `未找到日期 ${date} 的成分股数据`
      });
    }
    
    // 计算权重总和
    const totalWeight = constituents.reduce((sum, c) => sum + (c.weight || 0), 0);
    
    // 获取股票名称（从数据库）
    const stockCodes = constituents.map(c => c.con_code);
    const stockNames = {};
    
    // 批量获取股票名称
    for (const code of stockCodes) {
      try {
        // 使用dbService从stock_basic_info表获取股票名称
        const stockInfo = await dbService.getStockBasicInfo(code, date);
        if (stockInfo && stockInfo.name) {
          stockNames[code] = stockInfo.name;
        } else {
          // 如果数据库中没有，尝试从Tushare API获取
          const apiData = await tushareService.callApi('stock_basic', {
            ts_code: code,
            fields: 'ts_code,name'
          });
          if (apiData && apiData.length > 0 && apiData[0].name) {
            stockNames[code] = apiData[0].name;
          } else {
            stockNames[code] = code;
          }
        }
      } catch (error) {
        console.error(`获取股票 ${code} 名称失败:`, error.message);
        stockNames[code] = code;
      }
    }
    
    // 添加股票名称并按权重排序
    const result = constituents.map(c => ({
      con_code: c.con_code,
      name: stockNames[c.con_code] || c.con_code,
      weight: c.weight,
      trade_date: c.trade_date
    })).sort((a, b) => b.weight - a.weight);
    
    res.json({
      success: true,
      data: {
        date: date,
        constituents: result,
        count: result.length,
        totalWeight: totalWeight
      }
    });
  } catch (error) {
    console.error('查询指数成分股失败:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
