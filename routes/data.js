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
      data: dates  // 直接返回日期数组
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
      strategyType,
      maxWeight,
      useAdaptive,  // 新增：自适应策略开关
      // 综合得分策略参数
      mvWeight,
      dvWeight,
      qualityWeight,
      qualityFactorType,
      // 风险平价策略参数
      volatilityWindow,
      ewmaDecay,
      rebalanceFrequency,
      enableTradingCost,
      tradingCostRate,
      riskFreeRate,
      // 综合优化参数
      useQualityTilt,
      useCovariance,
      hybridRatio,
      // 动量因子参数
      useMomentumTilt,
      momentumWindow,
      momentumWeight,
      // 股票池筛选参数
      enableStockFilter,
      minROE,
      maxDebtRatio,
      momentumMonths,
      minMomentumReturn,
      filterByQuality
    } = req.query;
    
    // 使用用户配置的maxWeight，如果没有则使用环境变量的默认值
    const effectiveMaxWeight = maxWeight ? parseFloat(maxWeight) : MAX_WEIGHT;
    
    // 设置indexPortfolioService的maxWeight
    indexPortfolioService.maxWeight = effectiveMaxWeight;
    
    // 调试日志
    console.log('\n' + '='.repeat(80));
    console.log('📥 API接收到的参数:');
    console.log('='.repeat(80));
    console.log('策略类型 (strategyType):', strategyType);
    console.log('基础参数:', { volatilityWindow, ewmaDecay, rebalanceFrequency, enableTradingCost, tradingCostRate });
    console.log('综合优化参数:', { useQualityTilt, useCovariance, hybridRatio });
    console.log('='.repeat(80) + '\n');
    
    // 基础配置
    const config = {
      startDate: startDate || '',
      endDate: endDate || '',
      maxWeight: effectiveMaxWeight,
      useCompositeScore: false,
      useRiskParity: false,
      useAdaptive: useAdaptive === 'true'  // 自适应策略开关
    };
    
    // 根据策略类型添加对应参数
    if (strategyType === 'riskParity') {
      // 风险平价策略
      config.useRiskParity = true;
      config.riskParityParams = {
        volatilityWindow: parseInt(volatilityWindow) || 12,
        ewmaDecay: parseFloat(ewmaDecay) || 0.94,
        rebalanceFrequency: rebalanceFrequency || 'yearly',
        enableTradingCost: enableTradingCost === 'true',
        tradingCostRate: parseFloat(tradingCostRate) || 0,
        riskFreeRate: parseFloat(riskFreeRate) || 0.02,
        // 综合优化参数
        useQualityTilt: useQualityTilt === 'true',
        useCovariance: useCovariance === 'true',
        hybridRatio: parseFloat(hybridRatio) || 0,
        // 动量因子参数
        useMomentumTilt: useMomentumTilt === 'true',
        momentumWindow: parseInt(momentumWindow) || 6,
        momentumWeight: parseFloat(momentumWeight) || 0.3,
        // 股票池筛选参数
        enableStockFilter: enableStockFilter === 'true',
        stockFilterParams: enableStockFilter === 'true' ? {
          minROE: minROE !== undefined && minROE !== null ? parseFloat(minROE) : 0.05,
          maxDebtRatio: maxDebtRatio !== undefined && maxDebtRatio !== null ? parseFloat(maxDebtRatio) : 0.70,
          momentumMonths: parseInt(momentumMonths) || 6,
          minMomentumReturn: minMomentumReturn !== undefined && minMomentumReturn !== null ? parseFloat(minMomentumReturn) : -0.20,
          filterByQuality: filterByQuality === 'true'
        } : null
      };
      
      console.log('\n' + '='.repeat(80));
      console.log('✅ 构建的配置对象:');
      console.log('='.repeat(80));
      console.log(JSON.stringify(config, null, 2));
      console.log('='.repeat(80) + '\n');
    } else if (strategyType === 'composite') {
      // 综合得分策略
      config.useCompositeScore = true;
      config.scoreWeights = {
        mvWeight: parseFloat(mvWeight) || 0.5,
        dvWeight: parseFloat(dvWeight) || 0.3,
        qualityWeight: parseFloat(qualityWeight) || 0.2
      };
      config.qualityFactorType = qualityFactorType || 'pe_pb';
    }
    // strategyType === 'marketValue' 时不需要额外参数
    
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
        dailyData: result.dailyData || null,  // 新增：每日数据
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
 * 获取所有调仓变化详情
 */
router.get('/rebalance-changes', async (req, res) => {
  try {
    await dbService.init();
    const changes = await dbService.getRebalanceChanges(INDEX_CODE);
    
    res.json({
      success: true,
      data: changes
    });
  } catch (error) {
    console.error('获取调仓变化详情失败:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取512890.SH基金的持仓数据
 * 查询参数:
 * - endDate: 披露日期，格式YYYYMMDD（如 20231231）
 */
router.get('/fund-holdings', async (req, res) => {
  try {
    const { endDate } = req.query;
    
    if (!endDate) {
      return res.json({
        success: false,
        error: '请提供披露日期参数'
      });
    }
    
    // 获取基金持仓数据
    const holdings = await tushareService.getFundHoldings(FUND_CODE);
    
    if (!holdings || holdings.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // 筛选指定披露期的数据
    const filteredHoldings = holdings.filter(h => h.end_date === endDate);
    
    // 按持仓比例排序
    const sortedHoldings = filteredHoldings.sort((a, b) => {
      const ratioA = parseFloat(a.stk_mkv_ratio) || 0;
      const ratioB = parseFloat(b.stk_mkv_ratio) || 0;
      return ratioB - ratioA;
    });
    
    // 获取前10大重仓股
    const top10 = sortedHoldings.slice(0, 10);
    
    // 批量获取股票名称
    const stockCodes = top10.map(h => h.symbol);
    const stockNames = {};
    
    for (const code of stockCodes) {
      try {
        const stockInfo = await dbService.getStockBasicInfo(code, endDate);
        if (stockInfo && stockInfo.name) {
          stockNames[code] = stockInfo.name;
        } else {
          // 如果数据库中没有，尝试从 Tushare API 获取
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
    
    // 添加股票名称
    const result = top10.map(h => ({
      symbol: h.symbol,
      name: stockNames[h.symbol] || h.symbol,
      stk_mkv_ratio: h.stk_mkv_ratio,
      mkv: h.mkv,
      amount: h.amount,
      end_date: h.end_date
    }));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取基金持仓失败:', error);
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
    
    // 计算权重总和（确保转换为数字）
    const totalWeight = constituents.reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);
    
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

// ==================== 市场温度计相关接口 ====================

/**
 * 获取当前市场温度
 */
router.get('/market-temperature', async (req, res) => {
  try {
    const { indexCode } = req.query;
    const marketThermometerService = require('../services/marketThermometerService');
    
    const temperature = await marketThermometerService.calculateMarketTemperature(indexCode);
    
    res.json({
      success: true,
      data: temperature
    });
  } catch (error) {
    console.error('获取市场温度失败:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取历史市场温度
 */
router.get('/historical-temperature', async (req, res) => {
  try {
    const { indexCode, startDate, endDate } = req.query;
    const marketThermometerService = require('../services/marketThermometerService');
    
    const temperatures = await marketThermometerService.calculateHistoricalTemperature(
      indexCode,
      startDate,
      endDate
    );
    
    const distribution = marketThermometerService.calculateTemperatureDistribution(temperatures);
    
    res.json({
      success: true,
      data: {
        temperatures,
        distribution
      }
    });
  } catch (error) {
    console.error('获取历史温度失败:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
