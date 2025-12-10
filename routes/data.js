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
 * 获取所有报告期收益率
 */
router.get('/all-returns', async (req, res) => {
  try {
    const returns = await portfolioService.calculateAllPeriodReturns(FUND_CODE, MAX_WEIGHT);
    res.json({
      success: true,
      data: {
        adjustedReturns: returns,
        fundNav: []
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
