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
 * 获取所有可用的报告期（包含持仓数量信息）
 */
router.get('/report-periods', async (req, res) => {
  try {
    const holdings = await tushareService.getFundHoldings(FUND_CODE);
    
    // 按报告期分组
    const groupedHoldings = {};
    holdings.forEach(h => {
      if (!groupedHoldings[h.end_date]) {
        groupedHoldings[h.end_date] = [];
      }
      groupedHoldings[h.end_date].push(h);
    });
    
    // 找出第一个完整披露的报告期
    const allPeriods = Object.keys(groupedHoldings).sort();
    let firstValidPeriod = null;
    for (let i = 0; i < allPeriods.length; i++) {
      if (groupedHoldings[allPeriods[i]].length > 10) {
        firstValidPeriod = allPeriods[i];
        break;
      }
    }
    
    // 构建报告期信息
    const periodInfo = allPeriods.map(period => ({
      date: period,
      holdingCount: groupedHoldings[period].length,
      isPartial: groupedHoldings[period].length <= 10,
      isFirstValid: period === firstValidPeriod
    }));
    
    res.json({
      success: true,
      data: {
        periods: allPeriods,  // 保持兼容性
        periodInfo: periodInfo,
        firstValidPeriod: firstValidPeriod
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
      qualityWeight,
      qualityFactorType,
      maxWeight
    } = req.query;
    
    // 使用用户配置的maxWeight，如果没有则使用环境变量的默认值
    const effectiveMaxWeight = maxWeight ? parseFloat(maxWeight) : MAX_WEIGHT;
    
    const options = {
      reportPeriods: reportPeriods ? reportPeriods.split(',') : [],
      useCompositeScore: useCompositeScore === 'true',
      scoreWeights: {
        mvWeight: parseFloat(mvWeight) || 0.5,
        dvWeight: parseFloat(dvWeight) || 0.3,
        qualityWeight: parseFloat(qualityWeight) || 0.2
      },
      qualityFactorType: qualityFactorType || 'pe_pb'
    };
    
    const result = await portfolioService.calculateAllPeriodReturns(FUND_CODE, effectiveMaxWeight, options);
    res.json({
      success: true,
      data: {
        periods: result.periods || [],
        customRisk: result.customRisk || null,
        originalRisk: result.originalRisk || null,
        fundRisk: result.fundRisk || null,
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
