const express = require('express');
const router = express.Router();
const tushareService = require('../services/tushareService');
const portfolioService = require('../services/portfolioService');

const FUND_CODE = process.env.FUND_CODE || '512890.OF';
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
 * 获取所有可用的报告期
 */
router.get('/report-periods', async (req, res) => {
  try {
    const holdings = await tushareService.getFundHoldings(FUND_CODE);
    const periods = [...new Set(holdings.map(h => h.end_date))].sort();
    res.json({
      success: true,
      data: periods
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取所有报告期收益率
 * 查询参数:
 * - reportPeriods: 报告期列表，逗号分隔，如 "20250630,20241231"
 * - useCompositeScore: 是否使用综合得分策略，true/false
 * - mvWeight: 市值权重，0-1之间
 * - dvWeight: 股息率权重，0-1之间
 * - qualityWeight: 质量因子权重，0-1之间
 */
router.get('/all-returns', async (req, res) => {
  try {
    const {
      reportPeriods,
      useCompositeScore,
      mvWeight,
      dvWeight,
      qualityWeight
    } = req.query;
    
    const options = {
      reportPeriods: reportPeriods ? reportPeriods.split(',') : [],
      useCompositeScore: useCompositeScore === 'true',
      scoreWeights: {
        mvWeight: parseFloat(mvWeight) || 0.5,
        dvWeight: parseFloat(dvWeight) || 0.3,
        qualityWeight: parseFloat(qualityWeight) || 0.2
      }
    };
    
    const returns = await portfolioService.calculateAllPeriodReturns(FUND_CODE, MAX_WEIGHT, options);
    res.json({
      success: true,
      data: {
        adjustedReturns: returns,
        fundNav: [],
        options: options  // 返回使用的配置
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
