const express = require('express');
const router = express.Router();
const tushareService = require('../services/tushareService');
const portfolioService = require('../services/portfolioService');
const indexPortfolioService = require('../services/indexPortfolioService');

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

module.exports = router;
