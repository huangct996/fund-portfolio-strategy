const tushareService = require('./tushareService');
const stockFilterService = require('./stockFilterService');
const marketRegimeService = require('./marketRegimeService');
const marketThermometerService = require('./marketThermometerService');

/**
 * 基于指数成分股的投资组合回测服务
 * 用于跟踪指数成分股并计算收益率
 */
class IndexPortfolioService {
  constructor(maxWeight = 0.10) {
    this.maxWeight = maxWeight;
  }

  /**
   * 计算基于指数成分股的回测收益率
   * @param {string} indexCode - 指数代码，如 'h30269.CSI'
   * @param {string} fundCode - 基金代码，用于获取基金净值对比，如 '512890.SH'
   * @param {Object} config - 配置参数
   */
  async calculateIndexBasedReturns(indexCode, fundCode, config = {}) {
    const {
      startDate = '',
      endDate = '',
      useCompositeScore = false,
      useRiskParity = false,
      useAdaptive = false,
      scoreWeights = { mvWeight: 0.5, dvWeight: 0.3, qualityWeight: 0.2 },
      qualityFactorType = 'pe_pb',
      riskParityParams = null
    } = config;

    console.log('\n' + '='.repeat(60));
    console.log(`🚀 开始计算基于指数成分股的回测收益率`);
    console.log(`指数代码: ${indexCode}`);
    console.log(`基金代码: ${fundCode} (用于净值对比)`);
    if (startDate) console.log(`开始日期: ${startDate}`);
    if (endDate) console.log(`结束日期: ${endDate}`);
    console.log(`\n📋 配置对象:`, JSON.stringify(config, null, 2));
    console.log(`\n🎯 策略标志:`);
    console.log(`   useCompositeScore: ${useCompositeScore}`);
    console.log(`   useRiskParity: ${useRiskParity}`);
    if (useRiskParity) {
      console.log(`\n✅ 策略类型: 风险平价策略`);
      console.log(`📊 风险平价参数:`, riskParityParams);
    } else if (useCompositeScore) {
      console.log(`\n✅ 策略类型: 综合得分策略`);
    } else {
      console.log(`\n✅ 策略类型: 市值加权策略`);
    }
    console.log('='.repeat(60) + '\n');

    // 1. 获取指数的所有调仓日期
    let rebalanceDates = await tushareService.getIndexWeightDates(indexCode);
    
    if (!rebalanceDates || rebalanceDates.length === 0) {
      throw new Error(`未找到指数 ${indexCode} 的调仓日期数据`);
    }

    // 2. 根据日期范围过滤调仓日期
    if (startDate) {
      rebalanceDates = rebalanceDates.filter(date => date >= startDate);
    }
    if (endDate) {
      rebalanceDates = rebalanceDates.filter(date => date <= endDate);
    }

    if (rebalanceDates.length === 0) {
      throw new Error(`在指定日期范围内未找到调仓日期`);
    }

    // console.log(`✅ 获取到 ${rebalanceDates.length} 个调仓日期`);
    // console.log(`回测起始日期: ${rebalanceDates[0]}`);
    // console.log(`回测结束日期: ${rebalanceDates[rebalanceDates.length - 1]}\n`);

    // 保存原始年度调仓日期（用于指数策略）
    const yearlyRebalanceDates = [...rebalanceDates];
    
    // 如果是风险平价策略且需要更高频率调仓，生成新的调仓日期
    if (useRiskParity && riskParityParams && riskParityParams.rebalanceFrequency !== 'yearly') {
      const originalDates = [...rebalanceDates];
      rebalanceDates = this.generateHighFrequencyRebalanceDates(
        rebalanceDates, 
        riskParityParams.rebalanceFrequency,
        endDate  // 传入结束日期，以便生成到结束日期为止的所有调仓日期
      );
      // console.log(`🔄 生成高频调仓日期: ${originalDates.length} → ${rebalanceDates.length} 个`);
      // console.log(`   自定义策略: ${riskParityParams.rebalanceFrequency === 'quarterly' ? '每季度' : '每月'}调仓`);
      // console.log(`   指数策略: 年度调仓（保持不变）`);
      // console.log(`   年度调仓日期: ${yearlyRebalanceDates.join(', ')}\n`);
    }

    const results = [];
    let previousWeights = null; // 用于计算交易成本
    let currentIndexWeights = null; // 指数策略当前持仓（只在年度调仓期更新）
    
    // 2. 如果用户选择的开始日期早于第一个调仓日期，在开始日期建仓
    if (startDate && startDate < rebalanceDates[0]) {
      // console.log(`\n${'='.repeat(60)}`);
      // console.log(`在用户选择的开始日期建仓: ${startDate}`);
      // console.log(`${'='.repeat(60)}`);
      
      // 查找最近的历史年度调仓日期（在开始日期之前）
      const allYearlyDates = await tushareService.getIndexWeightDates(indexCode);
      const historicalYearlyDate = allYearlyDates
        .filter(d => d < startDate)
        .sort((a, b) => b.localeCompare(a))[0];
      
      if (historicalYearlyDate) {
        // console.log(`   使用最近的历史年度调仓日期: ${historicalYearlyDate}`);
        const indexWeights = await tushareService.getIndexWeightByDate(indexCode, historicalYearlyDate);
        
        if (indexWeights && indexWeights.length > 0) {
          // 初始化指数策略持仓
          currentIndexWeights = indexWeights;
          
          const firstRebalanceDate = rebalanceDates[0];
          const periodResult = await this.calculatePeriodReturns(
            indexWeights,
            startDate,
            firstRebalanceDate,
            fundCode,
            config,
            null,
            true,  // 总是计算指数收益率
            indexWeights,  // 指数策略持仓
            true  // 视为年度调仓
          );
          
          if (periodResult) {
            results.push({
              rebalanceDate: startDate,
              startDate: startDate,
              endDate: firstRebalanceDate,
              isStartDate: true,  // 标记为开始日期
              isYearlyRebalance: true,  // 开始日期视为年度调仓
              historicalRebalanceDate: historicalYearlyDate,  // 记录使用的历史调仓日期
              ...periodResult
            });
            
            if (periodResult.currentWeights) {
              previousWeights = periodResult.currentWeights;
            }
          }
        }
      } else {
        console.warn(`⚠️  未找到开始日期 ${startDate} 之前的历史年度调仓日期`);
      }
    }
    
    // 3. 遍历每个调仓日期，计算收益率
    for (let i = 0; i < rebalanceDates.length; i++) {
      const currentDate = rebalanceDates[i];
      const nextDate = i < rebalanceDates.length - 1 ? rebalanceDates[i + 1] : null;
      
      // console.log(`\n${'='.repeat(60)}`);
      // console.log(`处理调仓日期 ${i + 1}/${rebalanceDates.length}: ${currentDate}`);
      // console.log(`${'='.repeat(60)}`);

      try {
        // 判断当前日期是否是年度调仓日（指数策略在年度调仓时更新持仓）
        const isYearlyRebalance = yearlyRebalanceDates.includes(currentDate);
        // console.log(`   当前日期 ${currentDate} 是否年度调仓: ${isYearlyRebalance}`);
        
        // 🔄 自适应策略：基于市场温度调整参数
        let marketTemperature = null;
        let marketRegime = null;
        let effectiveRiskParityParams = riskParityParams;
        
        if (useAdaptive && useRiskParity && riskParityParams) {
          try {
            // 🌡️ 计算市场温度（多指数综合温度）
            marketTemperature = await marketThermometerService.calculateCompositeTemperature(currentDate);
            
            // 使用温度计的策略参数建议
            const adaptiveParams = marketTemperature.params;
            
            // 合并自适应参数到基础参数
            effectiveRiskParityParams = {
              ...riskParityParams,
              maxWeight: adaptiveParams.maxWeight,
              volatilityWindow: adaptiveParams.volatilityWindow
            };
            
            // 更新质量过滤参数
            if (effectiveRiskParityParams.stockFilterParams) {
              effectiveRiskParityParams.stockFilterParams = {
                ...effectiveRiskParityParams.stockFilterParams,
                filterByQuality: adaptiveParams.filterByQuality,
                minROE: adaptiveParams.minROE || effectiveRiskParityParams.stockFilterParams.minROE,
                maxDebtRatio: adaptiveParams.maxDebtRatio || effectiveRiskParityParams.stockFilterParams.maxDebtRatio
              };
            }
            
            // 每4个调仓期输出一次，避免日志过多
            if (i === 0 || i % 4 === 0) {
              console.log(`\n🌡️ [${currentDate}] 市场温度: ${marketTemperature.temperature}° (${marketTemperature.levelName})`);
              console.log(`   PE: ${marketTemperature.values.pe?.toFixed(2) || 'N/A'} (温度${marketTemperature.components.pe}°), PB: ${marketTemperature.values.pb?.toFixed(2) || 'N/A'} (温度${marketTemperature.components.pb}°)`);
              console.log(`   置信度: ${(marketTemperature.confidence * 100).toFixed(0)}%`);
              console.log(`   调整参数: maxWeight=${(adaptiveParams.maxWeight * 100).toFixed(0)}%, volatilityWindow=${adaptiveParams.volatilityWindow}月, filterByQuality=${adaptiveParams.filterByQuality}`);
            }
          } catch (error) {
            console.warn(`⚠️  计算市场温度失败，使用默认参数: ${error.message}`);
          }
        }
        
        // 获取自定义策略的成分股权重
        // 对于季度/月度调仓，如果当前日期没有成分股数据，则使用最近的历史年度调仓日期的数据
        let customIndexWeights = await tushareService.getIndexWeightByDate(indexCode, currentDate);
        
        if (!customIndexWeights || customIndexWeights.length === 0) {
          // 查找最近的历史年度调仓日期
          const nearestYearlyDate = yearlyRebalanceDates
            .filter(d => d <= currentDate)
            .sort((a, b) => b.localeCompare(a))[0];
          
          if (nearestYearlyDate && nearestYearlyDate !== currentDate) {
            // console.log(`   ℹ️  当前日期 ${currentDate} 无成分股数据，使用最近的年度调仓日期 ${nearestYearlyDate} 的数据`);
            customIndexWeights = await tushareService.getIndexWeightByDate(indexCode, nearestYearlyDate);
          }
          
          if (!customIndexWeights || customIndexWeights.length === 0) {
            console.warn(`⚠️  调仓日期 ${currentDate} 及其最近的年度调仓日期均无成分股数据，跳过`);
            continue;
          }
        }

        // console.log(`成分股数量: ${customIndexWeights.length} 只`);
        
        // 如果是年度调仓期，更新指数策略持仓
        if (isYearlyRebalance) {
          currentIndexWeights = customIndexWeights;
          // console.log(`   📊 指数策略更新持仓（年度调仓）`);
        } else if (!currentIndexWeights) {
          // 如果还没有初始化指数持仓，使用当前的成分股数据
          currentIndexWeights = customIndexWeights;
          // console.log(`   📊 指数策略初始化持仓`);
        } else {
          // console.log(`   📊 指数策略保持持仓不变（非年度调仓）`);
        }
        
        // 计算持有时间段
        const startDate = currentDate;  // 在调仓日建仓
        const periodEndDate = nextDate || (endDate && endDate > currentDate ? endDate : this.getTodayDate());  // 持有到下一个调仓日、用户结束日期或今天
        
        // console.log(`持有时间段: ${startDate} → ${endDate}`);

        // 3. 计算三种策略的收益率
        // 自定义策略使用customIndexWeights，指数策略使用currentIndexWeights
        // 指数策略需要在所有期间都计算收益率，以确保数据连续性
        // 但只在年度调仓期标记为isYearlyRebalance，用于后续筛选
        
        // 如果启用自适应策略，使用调整后的参数
        const effectiveConfig = useAdaptive && effectiveRiskParityParams ? {
          ...config,
          riskParityParams: effectiveRiskParityParams
        } : config;
        
        const periodResult = await this.calculatePeriodReturns(
          customIndexWeights,
          startDate,
          periodEndDate,
          fundCode,
          effectiveConfig,
          previousWeights,
          true,  // 总是计算指数收益率，确保数据连续性
          currentIndexWeights,  // 传入指数策略的持仓
          isYearlyRebalance  // 传入是否年度调仓的标记
        );

        if (periodResult) {
          results.push({
            rebalanceDate: currentDate,
            startDate,
            endDate: periodEndDate,
            isYearlyRebalance,  // 添加年度调仓标记
            marketTemperature: marketTemperature ? marketTemperature.temperature : null,
            temperatureLevel: marketTemperature ? marketTemperature.levelName : null,
            temperatureComponents: marketTemperature ? marketTemperature.components : null,
            adaptiveParams: marketTemperature ? marketTemperature.params : null,
            ...periodResult
          });
          
          // 更新上一期权重（用于下一期计算交易成本）
          if (periodResult.currentWeights) {
            previousWeights = periodResult.currentWeights;
          }
        }

      } catch (error) {
        console.error(`处理调仓日期 ${currentDate} 时出错:`, error.message);
        continue;
      }
    }
    
    // 4. 如果用户选择的结束日期晚于最后一个调仓日期，持仓到结束日期
    if (endDate && results.length > 0) {
      const lastResult = results[results.length - 1];
      const lastRebalanceDate = lastResult.rebalanceDate;
      const lastPeriodEndDate = lastResult.endDate;
      const lastYearlyRebalanceDate = yearlyRebalanceDates[yearlyRebalanceDates.length - 1];
      
      // 只有当最后一个期间的结束日期早于用户结束日期时，才添加额外的期间
      if (endDate > lastRebalanceDate && lastPeriodEndDate < endDate) {
        // console.log(`\n${'='.repeat(60)}`);
        // console.log(`持仓到用户选择的结束日期: ${endDate}`);
        // console.log(`${'='.repeat(60)}`);
        
        // 使用最后一个调仓期的持仓，计算到结束日期的收益率
        const indexWeights = await tushareService.getIndexWeightByDate(indexCode, lastRebalanceDate);
        
        if (indexWeights && indexWeights.length > 0) {
          // 对于结束日期期间，如果最后一个调仓日期是年度调仓日期，或者最后一个调仓日期在年度调仓日期之后，
          // 都应该计算指数收益率，以确保指数策略的数据完整性
          const isLastYearlyPeriod = lastRebalanceDate === lastYearlyRebalanceDate;
          const shouldCalculateIndex = isLastYearlyPeriod || lastRebalanceDate >= lastYearlyRebalanceDate;
          
          const periodResult = await this.calculatePeriodReturns(
            indexWeights,
            lastRebalanceDate,
            endDate,
            fundCode,
            config,
            previousWeights,
            shouldCalculateIndex,  // 如果是年度调仓期或之后的期间，都计算指数收益率
            currentIndexWeights,  // 使用当前指数策略持仓
            isLastYearlyPeriod  // 传入是否年度调仓的标记
          );
          
          if (periodResult) {
            results.push({
              rebalanceDate: endDate,
              startDate: lastRebalanceDate,
              endDate: endDate,
              isEndDate: true,  // 标记为结束日期
              isYearlyRebalance: isLastYearlyPeriod,  // 根据实际情况设置
              ...periodResult
            });
          }
        }
      } else if (endDate > lastYearlyRebalanceDate && lastRebalanceDate > lastYearlyRebalanceDate) {
        // 特殊情况：自定义策略的最后调仓日期在年度调仓日期之后，但用户结束日期在自定义策略最后调仓日期之前或等于
        // 这种情况下，需要为指数策略添加从最后年度调仓日期到用户结束日期的期间
        // 但自定义策略已经覆盖了这个期间，所以不需要额外处理
      }
    }

    // 5. 计算累计收益率
    this.calculateCumulativeReturns(results);

    // 5.5 收集所有调仓期的每日数据，并计算跨期累计收益率
    const allCustomDailyReturns = [];
    const allIndexDailyReturns = [];
    
    // 跨调仓期累计收益率：每个调仓期的期间收益率与上一期累计收益率复利
    let customCumulativeReturn = 0;
    let indexCumulativeReturn = 0;
    
    results.forEach((period, idx) => {
      if (period.customDailyReturns && period.customDailyReturns.length > 0) {
        // 计算当前调仓期的累计收益率
        // 注意：day.periodReturn 已经是从调仓日到当前日的累计收益率（portfolioValue - 1）
        // 所以跨期累计时，需要用复利公式：(1 + 上期末累计) × (1 + 当期累计) - 1
        period.customDailyReturns.forEach(day => {
          // 过滤掉超过用户选择的结束日期的数据
          if (endDate && day.date > endDate) {
            return;
          }
          
          // 当前日的累计收益率 = (1 + 上期末累计) × (1 + 当期从调仓日到当前日的累计) - 1
          const currentCumulative = (1 + customCumulativeReturn) * (1 + day.periodReturn) - 1;
          
          allCustomDailyReturns.push({
            date: day.date,
            periodReturn: day.periodReturn,  // 从调仓日到当前日的期间收益率
            cumulative: currentCumulative,   // 从起点到当前日的累计收益率
            periodIndex: idx,
            isRebalanceDate: day.date === period.rebalanceDate
          });
        });
        
        // 更新累计收益率：使用当期最后一天的期间收益率
        const validDays = period.customDailyReturns.filter(d => !endDate || d.date <= endDate);
        if (validDays.length > 0) {
          const lastDay = validDays[validDays.length - 1];
          // 跨期累计：(1 + 上期末) × (1 + 当期末) - 1
          customCumulativeReturn = (1 + customCumulativeReturn) * (1 + lastDay.periodReturn) - 1;
        }
      }
      
      if (period.indexDailyReturns && period.indexDailyReturns.length > 0) {
        period.indexDailyReturns.forEach(day => {
          // 过滤掉超过用户选择的结束日期的数据
          if (endDate && day.date > endDate) {
            return;
          }
          
          const currentCumulative = (1 + indexCumulativeReturn) * (1 + day.periodReturn) - 1;
          
          allIndexDailyReturns.push({
            date: day.date,
            periodReturn: day.periodReturn,
            cumulative: currentCumulative,
            periodIndex: idx,
            isRebalanceDate: day.date === period.rebalanceDate,
            isYearlyRebalance: period.isYearlyRebalance
          });
        });
        
        const validDays = period.indexDailyReturns.filter(d => !endDate || d.date <= endDate);
        if (validDays.length > 0) {
          const lastDay = validDays[validDays.length - 1];
          indexCumulativeReturn = (1 + indexCumulativeReturn) * (1 + lastDay.periodReturn) - 1;
        }
      }
    });

    // 6. 计算风险指标（基于每日收益率）
    const customReturns = results.map(r => r.customReturn);
    
    // 指数收益率：只使用年度调仓期的收益率
    const yearlyResults = results.filter(r => r.isYearlyRebalance);
    const indexReturns = yearlyResults.map(r => r.indexReturn);
    
    const fundReturns = results.map(r => r.fundReturn);

    console.log('\n📊 调仓期收益率统计:');
    console.log(`   自定义策略: ${customReturns.length}个调仓期`);
    console.log(`   指数策略: ${indexReturns.length}个年度调仓期`);
    console.log(`   基金净值: ${fundReturns.length}个调仓期`);

    // 传入完整的调仓期数组，用于计算年化频率
    // 从配置中获取无风险收益率，默认2%
    const riskFreeRate = (useRiskParity && riskParityParams && riskParityParams.riskFreeRate) 
      ? riskParityParams.riskFreeRate 
      : 0.02;
    
    // 使用每日收益率计算精确的风险指标
    const customRisk = allCustomDailyReturns.length > 0
      ? this.calculateRiskMetricsFromDailyReturns(allCustomDailyReturns, riskFreeRate, '自定义策略')
      : this.calculateRiskMetrics(customReturns, results, riskFreeRate);
    
    const indexRisk = allIndexDailyReturns.length > 0
      ? this.calculateRiskMetricsFromDailyReturns(allIndexDailyReturns, riskFreeRate, '指数策略')
      : this.calculateRiskMetrics(indexReturns, yearlyResults, riskFreeRate);
    
    const fundRisk = this.calculateRiskMetrics(fundReturns, results, riskFreeRate);
    
    // console.log('\n风险指标计算结果:');
    // console.log('自定义策略 - 最大回撤:', (customRisk.maxDrawdown * 100).toFixed(2) + '%');
    // console.log('指数策略 - 最大回撤:', (indexRisk.maxDrawdown * 100).toFixed(2) + '%');

    // 6. 计算跟踪误差
    // console.log(`\n计算跟踪误差 - 自定义策略收益率数量: ${customReturns.length}, 指数收益率数量: ${indexReturns.length}`);
    const trackingError = this.calculateTrackingError(customReturns, indexReturns);
    // if (trackingError) {
    //   console.log(`✅ 跟踪误差: ${(trackingError.trackingError * 100).toFixed(2)}%, 平均偏离: ${(trackingError.avgDifference * 100).toFixed(2)}%`);
    // } else {
    //   console.warn('⚠️ 跟踪误差计算失败（数组长度不匹配或数据不足）');
    // }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`回测完成`);
    console.log(`有效调仓期数: ${results.length}`);
    console.log(`${'='.repeat(60)}\n`);

    // 准备每日收益率数据用于前端绘图
    // 添加512890.SH基金的每日收益率数据
    const allFundDailyReturns = [];
    if (fundCode) {
      try {
        // 获取基金的完整净值数据
        const fundStartDate = startDate || rebalanceDates[0];
        const fundEndDate = endDate || rebalanceDates[rebalanceDates.length - 1];
        const fundNavData = await tushareService.getFundNav(fundCode, fundStartDate, fundEndDate);
        
        if (fundNavData && fundNavData.length > 0) {
          // 使用累计净值作为基准，避免基金拆分/分红导致的异常
          const baseNav = fundNavData[0].accum_nav;
          
          fundNavData.forEach(nav => {
            const cumulative = (nav.accum_nav - baseNav) / baseNav;
            allFundDailyReturns.push({
              date: nav.nav_date,
              cumulative: cumulative
            });
          });
          
          console.log(`✅ 获取到 ${allFundDailyReturns.length} 条基金每日净值数据（使用累计净值）`);
        }
      } catch (error) {
        console.warn(`⚠️ 获取基金每日净值数据失败: ${error.message}`);
      }
    }
    
    const dailyData = {
      custom: allCustomDailyReturns.map(d => ({
        date: d.date,
        cumulative: d.cumulative
      })),
      index: allIndexDailyReturns.map(d => ({
        date: d.date,
        cumulative: d.cumulative
      })),
      fund: allFundDailyReturns,  // 新增：基金每日收益率数据
      rebalanceDates: results.map(r => r.rebalanceDate)
    };
    
    console.log(`\n📊 返回给前端的数据:`);
    console.log(`   自定义策略每日数据点: ${dailyData.custom.length}`);
    console.log(`   指数策略每日数据点: ${dailyData.index.length}`);
    console.log(`   基金每日数据点: ${dailyData.fund.length}`);
    console.log(`   调仓日期标记点: ${dailyData.rebalanceDates.length}`);

    return {
      periods: results,
      customRisk,
      indexRisk,
      fundRisk,
      trackingError,
      dailyData  // 新增：每日收益率数据
    };
  }

  /**
   * 计算单个调仓期的收益率
   */
  async calculatePeriodReturns(indexWeights, startDate, endDate, fundCode, config, previousWeights = null, calculateIndexReturn = true, indexStrategyWeights = null, isYearlyRebalance = false) {
    const { useCompositeScore, useRiskParity, scoreWeights, qualityFactorType, riskParityParams } = config;
    
    // 如果没有传入指数策略持仓，使用自定义策略的持仓
    if (!indexStrategyWeights) {
      indexStrategyWeights = indexWeights;
    }

    // 1. 准备成分股列表
    const stockCodes = indexWeights.map(w => w.con_code);
    
    // 2. 获取股票的市值、股息率等数据
    const stocksWithData = await this.enrichStockData(indexWeights, startDate);
    
    if (stocksWithData.length === 0) {
      console.warn(`⚠️  无有效股票数据，跳过该期`);
      return null;
    }

    // 3. 计算自定义策略权重
    let customPortfolio;
    let currentWeights = null;
    let tradingCost = 0;
    
    let filteredOutStocks = [];
    if (useRiskParity && riskParityParams) {
      // 风险平价策略
      const riskParityResult = await this.calculateRiskParityWeights(
        stocksWithData,
        startDate,
        {
          volatilityWindow: riskParityParams.volatilityWindow,
          ewmaDecay: riskParityParams.ewmaDecay,
          maxWeight: riskParityParams.maxWeight || config.maxWeight,  // 优先使用riskParityParams.maxWeight（自适应策略）
          // 综合优化参数
          useQualityTilt: riskParityParams.useQualityTilt || false,
          useCovariance: riskParityParams.useCovariance || false,
          hybridRatio: riskParityParams.hybridRatio || 0,
          // 动量因子参数
          useMomentumTilt: riskParityParams.useMomentumTilt || false,
          momentumWindow: riskParityParams.momentumWindow || 6,
          momentumWeight: riskParityParams.momentumWeight || 0.3,
          // 股票池筛选参数（已在第194-200行处理过filterByQuality覆盖）
          enableStockFilter: riskParityParams.enableStockFilter || false,
          stockFilterParams: riskParityParams.stockFilterParams || null
        }
      );
      
      const riskParityWeights = riskParityResult.weights;
      filteredOutStocks = riskParityResult.removedStocks || [];
      
      customPortfolio = stocksWithData.map(stock => ({
        ...stock,
        adjustedWeight: riskParityWeights[stock.con_code] || 0
      }));
      
      currentWeights = riskParityWeights;
      
      // 计算交易成本
      if (riskParityParams.enableTradingCost && riskParityParams.tradingCostRate > 0) {
        tradingCost = this.calculateTradingCost(
          previousWeights,
          currentWeights,
          riskParityParams.tradingCostRate
        );
        console.log(`💰 交易成本: ${(tradingCost * 100).toFixed(3)}%`);
      }
    } else {
      // 原有策略（市值加权或综合得分）
      customPortfolio = this.calculateCustomWeights(
        stocksWithData,
        useCompositeScore,
        scoreWeights,
        qualityFactorType
      );
    }

    // 4. 准备指数策略组合（使用指数策略的持仓权重）
    const indexStocksWithData = await this.enrichStockData(indexStrategyWeights, startDate);
    const indexPortfolio = indexStocksWithData.map(stock => ({
      ...stock,
      adjustedWeight: stock.indexWeight / 100
    }));

    // 5. 计算三种策略的收益率（包含每日数据）
    const customResult = await this.calculatePortfolioDailyReturns(customPortfolio, startDate, endDate);
    const customReturns = customResult ? customResult.periodReturn : null;
    
    // 指数策略在所有调仓期都计算收益率
    let indexResult = null;
    let indexReturns = null;
    if (calculateIndexReturn) {
      indexResult = await this.calculatePortfolioDailyReturns(indexPortfolio, startDate, endDate);
      indexReturns = indexResult ? indexResult.periodReturn : null;
    }
    
    const fundNavReturn = await this.calculateReturnsFromNav(fundCode, startDate, endDate);

    if (!customReturns && customReturns !== 0) {
      return null;
    }

    // 扣除交易成本
    const netCustomReturn = customReturns - tradingCost;

    return {
      // 自定义策略
      customReturn: netCustomReturn,
      customReturnBeforeCost: customReturns,
      tradingCost: tradingCost,
      customStockCount: customResult ? customResult.tradingDays : 0,
      customDailyReturns: customResult ? customResult.dailyReturns : [],
      // 指数策略（所有调仓期都计算收益率）
      indexReturn: indexReturns,
      indexStockCount: indexResult ? indexResult.tradingDays : 0,
      indexDailyReturns: indexResult ? indexResult.dailyReturns : [],
      // 不在这里设置isYearlyRebalance，由调用方设置
      // 基金净值（如果返回null，则不设置这些字段，让它们为undefined）
      fundReturn: fundNavReturn?.return || 0,
      fundStartNav: fundNavReturn?.startNav,
      fundEndNav: fundNavReturn?.endNav,
      // 统计信息
      stockCount: stocksWithData.length,
      currentWeights: currentWeights, // 用于下一期计算交易成本
      // 只包含权重>0的股票（过滤后的持仓）
      holdings: customPortfolio
        .filter(p => p.adjustedWeight > 0)
        .map(p => ({
          symbol: p.con_code,
          name: p.name,
          indexWeight: p.indexWeight,
          customWeight: p.adjustedWeight,
          marketValue: p.marketValue,
          dvRatio: p.dvRatio,
          peTtm: p.peTtm,
          pb: p.pb,
          roe: p.roe || 0,
          debtRatio: p.debtRatio || 0,
          compositeScore: p.compositeScore || 0,
          qualityFactor: p.qualityFactor || 0,
          isLimited: p.isLimited || false,
          isFiltered: false
        })),
      // 添加被筛选掉的股票信息
      filteredOutStocks: filteredOutStocks.map(p => ({
        symbol: p.con_code,
        name: p.name,
        indexWeight: p.indexWeight,
        filterReason: p.filterReason || '未通过筛选'
      }))
    };
  }

  /**
   * 丰富股票数据（添加市值、股息率等）
   */
  async enrichStockData(indexWeights, tradeDate) {
    const stockCodes = indexWeights.map(w => w.con_code);
    
    // 批量获取股票基本信息（使用正确的方法名）
    const stockInfoMap = await tushareService.batchGetStockBasic(stockCodes, tradeDate);
    
    // 合并数据
    const enrichedStocks = [];
    for (const weight of indexWeights) {
      const info = stockInfoMap[weight.con_code];
      if (info && info.totalMv > 0) {
        enrichedStocks.push({
          con_code: weight.con_code,
          name: info.name || weight.con_code,
          indexWeight: weight.weight,  // 指数权重（百分比）
          marketValue: info.totalMv,
          dvRatio: info.dvRatio || 0,
          peTtm: info.peTtm || 0,
          pb: info.pb || 0,
          roe: info.roe || 0,
          debtRatio: info.debtRatio || 0
        });
      }
    }

    console.log(`有效股票数: ${enrichedStocks.length}/${indexWeights.length}`);
    
    return enrichedStocks;
  }

  /**
   * 计算自定义策略权重
   */
  calculateCustomWeights(stocks, useCompositeScore, scoreWeights, qualityFactorType) {
    let portfolio;

    if (useCompositeScore) {
      // 使用综合得分策略
      console.log(`使用综合得分策略`);
      portfolio = this.calculateCompositeScore(stocks, scoreWeights, qualityFactorType);
    } else {
      // 使用市值加权策略
      console.log(`使用市值加权策略`);
      const totalMv = stocks.reduce((sum, s) => sum + s.marketValue, 0);
      portfolio = stocks.map(s => ({
        ...s,
        adjustedWeight: s.marketValue / totalMv,
        isLimited: false
      }));
    }

    // 应用权重上限
    portfolio = this.applyWeightLimit(portfolio, useCompositeScore);

    return portfolio.sort((a, b) => b.adjustedWeight - a.adjustedWeight);
  }

  /**
   * 计算综合得分
   */
  calculateCompositeScore(stocks, weights, qualityFactorType) {
    const { mvWeight, dvWeight, qualityWeight } = weights;
    
    // 计算质量因子
    stocks.forEach(stock => {
      let qualityFactor = 0;
      
      if (qualityFactorType === 'roe') {
        qualityFactor = stock.roe || 0;
      } else if (qualityFactorType === 'pe') {
        qualityFactor = stock.peTtm > 0 ? 1 / stock.peTtm : 0;
      } else if (qualityFactorType === 'pb') {
        qualityFactor = stock.pb > 0 ? 1 / stock.pb : 0;
      } else {
        // pe_pb综合
        const peScore = stock.peTtm > 0 ? 1 / stock.peTtm : 0;
        const pbScore = stock.pb > 0 ? 1 / stock.pb : 0;
        qualityFactor = (peScore + pbScore) / 2;
      }
      
      stock.qualityFactor = qualityFactor;
    });
    
    // 归一化各因子
    const totalMv = stocks.reduce((sum, s) => sum + s.marketValue, 0);
    const totalDv = stocks.reduce((sum, s) => sum + s.dvRatio, 0);
    const totalQuality = stocks.reduce((sum, s) => sum + s.qualityFactor, 0);
    
    // 计算综合得分
    const stocksWithScore = stocks.map(s => {
      const mvScore = totalMv > 0 ? s.marketValue / totalMv : 0;
      const dvScore = totalDv > 0 ? s.dvRatio / totalDv : 0;
      const qualityScore = totalQuality > 0 ? s.qualityFactor / totalQuality : 0;
      
      const compositeScore = mvScore * mvWeight + dvScore * dvWeight + qualityScore * qualityWeight;
      
      return {
        ...s,
        compositeScore,
        adjustedWeight: 0,
        isLimited: false
      };
    });
    
    // 根据综合得分分配权重
    const totalScore = stocksWithScore.reduce((sum, stock) => sum + stock.compositeScore, 0);
    
    return stocksWithScore.map(s => {
      s.adjustedWeight = totalScore > 0 ? s.compositeScore / totalScore : 0;
      return s;
    });
  }

  /**
   * 应用权重上限
   */
  applyWeightLimit(portfolio, useCompositeScore) {
    const maxWeight = this.maxWeight;
    let needsAdjustment = true;
    let iterationCount = 0;
    const maxIterations = 100;

    while (needsAdjustment && iterationCount < maxIterations) {
      needsAdjustment = false;
      let excessWeight = 0;
      let unrestrictedCount = 0;
      iterationCount++;

      // 找出超过限制的股票
      portfolio.forEach(stock => {
        if (!stock.isLimited && stock.adjustedWeight > maxWeight) {
          const excess = stock.adjustedWeight - maxWeight;
          excessWeight += excess;
          stock.adjustedWeight = maxWeight;
          stock.isLimited = true;
          needsAdjustment = true;
        } else if (!stock.isLimited) {
          unrestrictedCount++;
        }
      });

      // 重新分配超出的权重
      if (excessWeight > 0 && unrestrictedCount > 0) {
        if (useCompositeScore) {
          const unrestrictedTotalScore = portfolio
            .filter(s => !s.isLimited)
            .reduce((sum, s) => sum + (s.compositeScore || 0), 0);
          
          portfolio.forEach(stock => {
            if (!stock.isLimited && unrestrictedTotalScore > 0) {
              const scoreRatio = (stock.compositeScore || 0) / unrestrictedTotalScore;
              stock.adjustedWeight += excessWeight * scoreRatio;
            }
          });
        } else {
          const unrestrictedTotalMv = portfolio
            .filter(s => !s.isLimited)
            .reduce((sum, s) => sum + s.marketValue, 0);
          
          portfolio.forEach(stock => {
            if (!stock.isLimited) {
              const mvRatio = stock.marketValue / unrestrictedTotalMv;
              stock.adjustedWeight += excessWeight * mvRatio;
            }
          });
        }
      }
    }

    return portfolio;
  }

  /**
   * 计算投资组合的每日收益率序列
   * @returns {Object} { periodReturn: 总收益率, dailyReturns: [{date, return, cumulative}] }
   */
  async calculatePortfolioDailyReturns(portfolio, startDate, endDate) {
    const stockCodes = portfolio.map(p => p.con_code || p.symbol);
    
    // 获取股票价格数据
    const priceData = await tushareService.batchGetStockPrices(stockCodes, startDate, endDate);
    
    // 收集所有股票的每日价格，按日期组织
    const dailyPricesByDate = new Map();
    const stockWeights = new Map();
    let validWeightSum = 0;

    for (const stock of portfolio) {
      const code = stock.con_code || stock.symbol;
      const prices = priceData[code];
      
      if (!prices || prices.length === 0) {
        console.warn(`⚠️  ${code} 无价格数据，跳过`);
        continue;
      }
      
      stockWeights.set(code, stock.adjustedWeight);
      validWeightSum += stock.adjustedWeight;
      
      // 按日期组织价格数据
      prices.forEach(price => {
        if (!dailyPricesByDate.has(price.trade_date)) {
          dailyPricesByDate.set(price.trade_date, new Map());
        }
        dailyPricesByDate.get(price.trade_date).set(code, price.close);
      });
    }

    if (stockWeights.size === 0) {
      return null;
    }

    // 归一化权重
    const normalizedWeights = new Map();
    stockWeights.forEach((weight, code) => {
      normalizedWeights.set(code, weight / validWeightSum);
    });

    // 按日期排序
    const sortedDates = Array.from(dailyPricesByDate.keys()).sort();
    
    // 计算期间收益率：从调仓日到当前日的收益率
    // 权重在期间内保持不变，直接用价格比计算
    const dailyReturns = [];
    const firstPrices = dailyPricesByDate.get(sortedDates[0]);
    
    for (let i = 0; i < sortedDates.length; i++) {
      const currDate = sortedDates[i];
      const currPrices = dailyPricesByDate.get(currDate);
      
      // 计算组合价值：Σ(当前价格/起始价格 × 权重)
      let portfolioValue = 0;
      let validWeightSum = 0;
      normalizedWeights.forEach((weight, code) => {
        const firstPrice = firstPrices.get(code);
        const currPrice = currPrices.get(code);
        
        if (firstPrice && currPrice && firstPrice > 0) {
          portfolioValue += (currPrice / firstPrice) * weight;
          validWeightSum += weight;
        }
      });
      
      // 归一化：如果有股票缺失数据，按有效权重归一化
      if (validWeightSum > 0 && validWeightSum < 0.999) {
        portfolioValue = portfolioValue / validWeightSum;
      } else if (validWeightSum === 0) {
        // 如果所有股票权重都是0或没有有效数据，保持上一期的价值（收益率为0）
        // 这种情况可能发生在筛选后没有符合条件的股票时
        portfolioValue = i > 0 ? dailyReturns[i - 1].portfolioValue : 1;
        console.warn(`⚠️  ${currDate}: 所有股票权重为0，保持上一期价值`);
      }
      
      // 期间收益率 = 组合价值 - 1
      const periodReturn = portfolioValue - 1;
      
      dailyReturns.push({
        date: currDate,
        periodReturn: periodReturn,  // 从调仓日到当前日的收益率（非复利）
        portfolioValue: portfolioValue
      });
    }

    // 计算期间总收益率
    const periodReturn = dailyReturns.length > 0 
      ? dailyReturns[dailyReturns.length - 1].periodReturn 
      : 0;

    return {
      periodReturn,
      dailyReturns,
      tradingDays: dailyReturns.length
    };
  }

  /**
   * 计算投资组合收益率（向后兼容的简化版本）
   */
  async calculatePortfolioReturns(portfolio, startDate, endDate) {
    const result = await this.calculatePortfolioDailyReturns(portfolio, startDate, endDate);
    return result ? result.periodReturn : null;
  }

  /**
   * 使用基金净值计算收益率
   */
  async calculateReturnsFromNav(fundCode, startDate, endDate) {
    const navData = await tushareService.getFundNav(fundCode, startDate, endDate);
    
    if (!navData || navData.length === 0) {
      console.warn(`⚠️  基金 ${fundCode} 在 ${startDate}-${endDate} 无净值数据`);
      return null;
    }

    // 找到最接近startDate的净值（可能是之前的日期，因为基金可能不是每天都有净值）
    const startNav = navData.find(n => n.nav_date >= startDate) || navData[0];
    // 找到最接近endDate的净值
    const endNav = navData.filter(n => n.nav_date <= endDate).pop() || navData[navData.length - 1];

    if (!startNav || !endNav || startNav.nav_date === endNav.nav_date) {
      console.warn(`⚠️  基金 ${fundCode} 在 ${startDate}-${endDate} 净值数据不足`);
      return null;
    }

    // 始终使用累计净值计算收益率，避免基金拆分和分红导致的异常
    if (!startNav.accum_nav || !endNav.accum_nav) {
      console.error(`❌ 无累计净值数据，跳过该期基金数据`);
      return null;
    }
    
    const accumNavChange = (endNav.accum_nav - startNav.accum_nav) / startNav.accum_nav;
    
    console.log(`📊 基金净值（累计）: ${startNav.nav_date}(${startNav.accum_nav}) → ${endNav.nav_date}(${endNav.accum_nav}), 收益率: ${(accumNavChange * 100).toFixed(2)}%`);
    
    return {
      return: accumNavChange,
      startNav: startNav.accum_nav,
      endNav: endNav.accum_nav,
      startDate: startNav.nav_date,
      endDate: endNav.nav_date
    };
  }

  /**
   * 计算累计收益率
   */
  calculateCumulativeReturns(results) {
    let customCumulative = 1;
    let indexCumulative = 1;
    
    // 获取基金的起始净值（第一期的startNav）
    const initialFundNav = results[0]?.fundStartNav || 1;
    let lastValidFundNav = initialFundNav;  // 记录最后一个有效的基金净值

    results.forEach((r, index) => {
      if (index === 0) {
        // 第一个调仓期：累计收益率为0（建仓基点）
        r.customCumulativeReturn = 0;
        r.indexCumulativeReturn = 0;
        r.fundCumulativeReturn = 0;
        r.trackingError = 0;
        
        if (r.fundEndNav) {
          lastValidFundNav = r.fundEndNav;
        }
      } else {
        // 后续调仓期：累加收益率
        customCumulative *= (1 + r.customReturn);
        
        // 指数收益率：只在年度调仓期累加收益率
        // 关键修复：只有年度调仓期才累加指数收益率，非年度调仓期保持上一期的累计值
        if (r.isYearlyRebalance && r.indexReturn !== null && r.indexReturn !== undefined) {
          indexCumulative *= (1 + r.indexReturn);
        }
        
        // 基金净值：使用当前净值相对于初始净值的涨幅
        // 如果当前期有有效净值，使用当前净值；否则使用上一期的净值
        const currentFundNav = r.fundEndNav || lastValidFundNav;
        const fundCumulativeReturn = (currentFundNav - initialFundNav) / initialFundNav;
        
        r.customCumulativeReturn = customCumulative - 1;
        r.indexCumulativeReturn = indexCumulative - 1;
        r.fundCumulativeReturn = fundCumulativeReturn;
        r.trackingError = r.customCumulativeReturn - r.indexCumulativeReturn;
        
        // 更新最后有效净值
        if (r.fundEndNav) {
          lastValidFundNav = r.fundEndNav;
        }
      }

      console.log(`调仓期${index + 1} ${r.rebalanceDate}: 自定义${(r.customCumulativeReturn * 100).toFixed(2)}%, 指数${(r.indexCumulativeReturn * 100).toFixed(2)}%, 基金${(r.fundCumulativeReturn * 100).toFixed(2)}%, 跟踪误差${(r.trackingError * 100).toFixed(2)}%`);
    });
  }

  /**
   * 基于基金净值数据计算指数风险指标（使用基金作为指数的代理）
   */
  async calculateIndexRiskMetricsFromFundNav(fundCode, startDate, endDate, riskFreeRate = 0.02) {
    try {
      // 获取基金净值数据
      const navData = await tushareService.getFundNav(fundCode, startDate, endDate);
      
      if (!navData || navData.length < 2) {
        throw new Error('基金净值数据不足');
      }
      
      // 按日期排序
      navData.sort((a, b) => a.nav_date.localeCompare(b.nav_date));
      
      // 计算日收益率
      const dailyReturns = [];
      for (let i = 1; i < navData.length; i++) {
        const prevNav = navData[i - 1].accum_nav || navData[i - 1].unit_nav;
        const currNav = navData[i].accum_nav || navData[i].unit_nav;
        if (prevNav > 0 && currNav > 0) {
          dailyReturns.push((currNav - prevNav) / prevNav);
        }
      }
      
      if (dailyReturns.length === 0) {
        throw new Error('无有效日收益率数据');
      }
      
      // 计算累计收益率
      const totalReturn = dailyReturns.reduce((prod, r) => prod * (1 + r), 1) - 1;
      
      // 计算实际年数
      const firstDate = new Date(
        navData[0].nav_date.substring(0, 4),
        parseInt(navData[0].nav_date.substring(4, 6)) - 1,
        navData[0].nav_date.substring(6, 8)
      );
      const lastDate = new Date(
        navData[navData.length - 1].nav_date.substring(0, 4),
        parseInt(navData[navData.length - 1].nav_date.substring(4, 6)) - 1,
        navData[navData.length - 1].nav_date.substring(6, 8)
      );
      const totalDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
      const actualYears = totalDays / 365;
      
      // 年化收益率
      const annualizedReturn = Math.pow(1 + totalReturn, 1 / actualYears) - 1;
      
      // 计算波动率（日收益率的标准差）
      const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
      const dailyVolatility = Math.sqrt(variance);
      
      // 年化波动率（假设252个交易日）
      const annualizedVolatility = dailyVolatility * Math.sqrt(252);
      
      // 夏普比率
      const sharpeRatio = annualizedVolatility > 0 
        ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
        : 0;
      
      // 最大回撤（基于净值数据）
      let maxDrawdown = 0;
      let peak = navData[0].accum_nav || navData[0].unit_nav;
      
      for (let i = 1; i < navData.length; i++) {
        const nav = navData[i].accum_nav || navData[i].unit_nav;
        if (nav > peak) {
          peak = nav;
        }
        const drawdown = (peak - nav) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
      
      console.log(`  📈 指数风险指标（基于基金${navData.length}个交易日净值）:`);
      console.log(`     累计收益率: ${(totalReturn * 100).toFixed(2)}%`);
      console.log(`     年化收益率: ${(annualizedReturn * 100).toFixed(2)}% (基于${actualYears.toFixed(2)}年)`);
      console.log(`     年化波动率: ${(annualizedVolatility * 100).toFixed(2)}%`);
      console.log(`     无风险收益率: ${(riskFreeRate * 100).toFixed(2)}%`);
      console.log(`     夏普比率: ${sharpeRatio.toFixed(2)}`);
      console.log(`     最大回撤: ${(maxDrawdown * 100).toFixed(2)}%`);
      
      return {
        totalReturn,
        annualizedReturn,
        volatility: annualizedVolatility,
        sharpeRatio,
        maxDrawdown,
        periods: navData.length
      };
    } catch (error) {
      console.error('基于基金净值计算指数风险指标失败:', error.message);
      throw error;
    }
  }

  /**
   * 基于每日收益率计算精确的风险指标
   * 使用 √252 进行年化，确保不同策略的比较基准一致
   */
  calculateRiskMetricsFromDailyReturns(dailyReturns, annualRiskFreeRate = 0.02, strategyName = '') {
    if (!dailyReturns || dailyReturns.length === 0) return null;

    // 计算每日收益率变化（用于波动率计算）
    const returns = [];
    for (let i = 1; i < dailyReturns.length; i++) {
      const prevCumulative = dailyReturns[i - 1].cumulative;
      const currCumulative = dailyReturns[i].cumulative;
      const dailyReturn = (1 + currCumulative) / (1 + prevCumulative) - 1;
      returns.push(dailyReturn);
    }
    const tradingDays = dailyReturns.length;
    
    // 1. 计算累计收益率
    const totalReturn = dailyReturns[dailyReturns.length - 1].cumulative;
    
    // 2. 计算实际时间跨度（年数）
    const firstDate = dailyReturns[0].date;
    const lastDate = dailyReturns[dailyReturns.length - 1].date;
    const firstDateObj = new Date(
      firstDate.substring(0, 4),
      parseInt(firstDate.substring(4, 6)) - 1,
      firstDate.substring(6, 8)
    );
    const lastDateObj = new Date(
      lastDate.substring(0, 4),
      parseInt(lastDate.substring(4, 6)) - 1,
      lastDate.substring(6, 8)
    );
    const totalDays = (lastDateObj - firstDateObj) / (1000 * 60 * 60 * 24);
    const actualYears = totalDays / 365;
    
    // 3. 年化收益率
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / actualYears) - 1;
    
    // 4. 计算每日平均收益率和波动率
    const avgDailyReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const dailyVariance = returns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / returns.length;
    const dailyVolatility = Math.sqrt(dailyVariance);
    
    // 5. 年化波动率 - 使用 √252
    const TRADING_DAYS_PER_YEAR = 252;
    const annualizedVolatility = dailyVolatility * Math.sqrt(TRADING_DAYS_PER_YEAR);
    
    // 6. 夏普比率
    const sharpeRatio = annualizedVolatility > 0 
      ? (annualizedReturn - annualRiskFreeRate) / annualizedVolatility 
      : 0;
    
    // 7. 索提诺比率（只考虑下行波动）
    const downReturns = returns.filter(r => r < 0);
    let sortinoRatio = 0;
    if (downReturns.length > 0) {
      const downVariance = downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
      const downVolatility = Math.sqrt(downVariance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
      sortinoRatio = downVolatility > 0 ? (annualizedReturn - annualRiskFreeRate) / downVolatility : 0;
    }
    
    // 8. 最大回撤
    let maxDrawdown = 0;
    let peak = 1;
    
    dailyReturns.forEach(d => {
      const cumulative = 1 + d.cumulative;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });
    
    console.log(`\n${strategyName} 风险指标: 累计收益${(totalReturn * 100).toFixed(2)}%, 年化收益${(annualizedReturn * 100).toFixed(2)}%, 夏普${sharpeRatio.toFixed(2)}, 最大回撤${(maxDrawdown * 100).toFixed(2)}%`);

    return {
      totalReturn,
      annualizedReturn,
      volatility: annualizedVolatility,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      tradingDays,
      actualYears,
      // 添加详细的计算参数说明
      calculationMethod: {
        dataType: 'daily',
        tradingDaysPerYear: TRADING_DAYS_PER_YEAR,
        volatilityAnnualizationFactor: Math.sqrt(TRADING_DAYS_PER_YEAR),
        riskFreeRateConversion: `(1 + ${annualRiskFreeRate})^(1/252) - 1`
      }
    };
  }

  /**
   * 计算风险指标（基于调仓期收益率，向后兼容）
   */
  calculateRiskMetrics(returns, periods, riskFreeRate = 0.02) {
    if (!returns || returns.length === 0) return null;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // 计算实际时间跨度（年数）
    let actualYears = 1; // 默认1年
    let periodsPerYear = 1; // 默认年度调仓（用于波动率年化）
    
    if (periods && periods.length > 1) {
      // 计算实际时间跨度
      const firstDate = new Date(
        periods[0].rebalanceDate.substring(0, 4),
        parseInt(periods[0].rebalanceDate.substring(4, 6)) - 1,
        periods[0].rebalanceDate.substring(6, 8)
      );
      const lastDate = new Date(
        periods[periods.length - 1].rebalanceDate.substring(0, 4),
        parseInt(periods[periods.length - 1].rebalanceDate.substring(4, 6)) - 1,
        periods[periods.length - 1].rebalanceDate.substring(6, 8)
      );
      const totalDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
      actualYears = totalDays / 365;
      
      // 计算平均调仓频率（用于波动率年化）
      const avgDaysPerPeriod = totalDays / (periods.length - 1);
      const avgPeriodsPerYear = 365 / avgDaysPerPeriod;
      periodsPerYear = Math.round(avgPeriodsPerYear);
      periodsPerYear = Math.max(1, Math.min(12, periodsPerYear));
      
      console.log(`  📊 时间跨度: ${periods.length}个调仓期, 实际${actualYears.toFixed(2)}年, 平均间隔${avgDaysPerPeriod.toFixed(0)}天, 年化频率=${avgPeriodsPerYear.toFixed(2)}次/年`);
    }
    
    // 计算累计收益率和年化收益率
    const totalReturn = returns.reduce((prod, r) => prod * (1 + r), 1) - 1;
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / actualYears) - 1;
    
    // 波动率年化：使用收益率数据的实际频率
    // 关键：必须使用 returns.length（收益率数据点数量），而不是 periods.length
    // 因为年化频率 = 收益率数据点数量 / 实际年数
    const actualPeriodsPerYear = returns.length > 1 
      ? (returns.length - 1) / actualYears 
      : periodsPerYear;
    const annualizedVolatility = volatility * Math.sqrt(actualPeriodsPerYear);
    
    // 夏普比率（使用可配置的无风险利率）
    const sharpeRatio = annualizedVolatility > 0 
      ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
      : 0;
    
    console.log(`  📈 风险指标详情:`);
    console.log(`     收益率数据点: ${returns.length}个`);
    console.log(`     时间跨度数据点: ${periods ? periods.length : 'N/A'}个`);
    console.log(`     期间平均收益率: ${(avgReturn * 100).toFixed(2)}%`);
    console.log(`     期间波动率: ${(volatility * 100).toFixed(2)}%`);
    console.log(`     累计收益率: ${(totalReturn * 100).toFixed(2)}%`);
    console.log(`     年化收益率: ${(annualizedReturn * 100).toFixed(2)}% (基于${actualYears.toFixed(2)}年)`);
    console.log(`     实际年化频率: ${actualPeriodsPerYear.toFixed(2)}次/年 (${returns.length}期收益率 / ${actualYears.toFixed(2)}年)`);
    console.log(`     年化波动率: ${(annualizedVolatility * 100).toFixed(2)}% = ${(volatility * 100).toFixed(2)}% × √${actualPeriodsPerYear.toFixed(2)}`);
    console.log(`     无风险收益率: ${(riskFreeRate * 100).toFixed(2)}%`);
    console.log(`     夏普比率: ${sharpeRatio.toFixed(2)} = (${(annualizedReturn * 100).toFixed(2)}% - ${(riskFreeRate * 100).toFixed(2)}%) / ${(annualizedVolatility * 100).toFixed(2)}%`);
    console.log(`\n     ⚠️ 注意：指数策略收益率数据点=${returns.length}，但只有${periods ? periods.length : 'N/A'}个年度调仓期`);
    
    // 索提诺比率（只考虑下行波动）
    const downReturns = returns.filter(r => r < 0);
    let sortinoRatio = 0;
    if (downReturns.length > 0) {
      const downVariance = downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
      const downVolatility = Math.sqrt(downVariance) * Math.sqrt(actualPeriodsPerYear);
      sortinoRatio = downVolatility > 0 ? (annualizedReturn - riskFreeRate) / downVolatility : 0;
    }
    
    // 最大回撤
    let maxDrawdown = 0;
    let peak = 1;
    let cumulative = 1;
    
    returns.forEach(r => {
      cumulative *= (1 + r);
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return {
      totalReturn,
      annualizedReturn,
      volatility: annualizedVolatility,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      periods
    };
  }

  /**
   * 计算跟踪误差
   */
  calculateTrackingError(customReturns, indexReturns) {
    if (!customReturns || !indexReturns || customReturns.length !== indexReturns.length) {
      return null;
    }

    const differences = customReturns.map((r, i) => r - indexReturns[i]);
    const avgDiff = differences.reduce((sum, d) => sum + d, 0) / differences.length;
    const variance = differences.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / differences.length;
    const trackingError = Math.sqrt(variance);
    
    // 年化跟踪误差
    const periodsPerYear = 4;
    const annualizedTE = trackingError * Math.sqrt(periodsPerYear);

    return {
      trackingError: annualizedTE,
      avgDifference: avgDiff,
      periods: customReturns.length
    };
  }

  /**
   * 获取今天的日期（YYYYMMDD格式）
   */
  getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * 使用EWMA计算股票的历史波动率
   * @param {Array} returns - 历史收益率数组
   * @param {number} decay - EWMA衰减系数 (0-1之间，如0.94)
   * @returns {number} 波动率
   */
  calculateEWMAVolatility(returns, decay = 0.94) {
    if (!returns || returns.length === 0) return 0;
    
    // 计算均值
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // 使用EWMA计算方差
    let ewmaVariance = 0;
    let weight = 1;
    let totalWeight = 0;
    
    // 从最近的数据开始，给予更高权重
    for (let i = returns.length - 1; i >= 0; i--) {
      const deviation = returns[i] - mean;
      ewmaVariance += weight * deviation * deviation;
      totalWeight += weight;
      weight *= decay;
    }
    
    ewmaVariance /= totalWeight;
    return Math.sqrt(ewmaVariance);
  }

  /**
   * 获取股票的历史日收益率数据（使用数据库缓存）
   * @param {string} tsCode - 股票代码
   * @param {string} endDate - 结束日期
   * @param {number} windowMonths - 窗口期（月）
   * @returns {Array} 日收益率数组
   */
  async getStockDailyReturns(tsCode, endDate, windowMonths = 12) {
    try {
      // 计算开始日期（向前推windowMonths个月）
      const endDateObj = new Date(
        endDate.substring(0, 4),
        parseInt(endDate.substring(4, 6)) - 1,
        endDate.substring(6, 8)
      );
      const startDateObj = new Date(endDateObj);
      startDateObj.setMonth(startDateObj.getMonth() - windowMonths);
      
      const startDate = startDateObj.getFullYear() + 
        String(startDateObj.getMonth() + 1).padStart(2, '0') + 
        String(startDateObj.getDate()).padStart(2, '0');
      
      // 使用 tushareService 的缓存机制获取日行情数据
      // 该方法会先从数据库查询，没有则从 Tushare 同步
      // 传入期望的最小数据量：每月约20个交易日，乘以窗口月数，再打8折作为阈值
      const expectedMinRecords = Math.floor(windowMonths * 20 * 0.8);
      
      // console.log(`  🔍 获取 ${tsCode} 历史数据: ${startDate}-${endDate}, 窗口=${windowMonths}月, 期望≥${expectedMinRecords}条`);
      
      const dailyData = await tushareService.getStockDailyWithCache(tsCode, startDate, endDate, expectedMinRecords);
      
      // console.log(`  📊 ${tsCode} 实际获取: ${dailyData ? dailyData.length : 0}条记录`);
      
      if (!dailyData || dailyData.length < 2) {
        console.log(`  ⚠️ ${tsCode}: 数据不足，获取到${dailyData ? dailyData.length : 0}条记录`);
        return [];
      }
      
      // 按日期升序排序
      dailyData.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
      
      // 计算日收益率（使用后复权价格）
      const returns = [];
      let validCount = 0;
      let invalidCount = 0;
      
      for (let i = 1; i < dailyData.length; i++) {
        const prevClose = dailyData[i - 1].adj_close || dailyData[i - 1].close_price || dailyData[i - 1].close;
        const currClose = dailyData[i].adj_close || dailyData[i].close_price || dailyData[i].close;
        
        if (prevClose > 0 && currClose > 0) {
          returns.push((currClose - prevClose) / prevClose);
          validCount++;
        } else {
          invalidCount++;
        }
      }
      
      if (invalidCount > 0) {
        console.log(`  ⚠️ ${tsCode}: ${invalidCount}条无效数据（价格<=0），有效数据${validCount}条`);
      }
      
      return returns;
    } catch (error) {
      console.error(`获取股票 ${tsCode} 历史收益率失败:`, error.message);
      return [];
    }
  }

  /**
   * 计算风险平价权重
   * @param {Array} stocks - 股票列表，包含tsCode
   * @param {string} rebalanceDate - 调仓日期
   * @param {Object} params - 风险平价参数
   * @returns {Object} 股票代码到权重的映射
   */
  async calculateRiskParityWeights(stocks, rebalanceDate, params = {}) {
    const {
      volatilityWindow = 12,
      ewmaDecay = 0.94,
      maxWeight = 0.15,
      useQualityTilt = false,  // 是否使用质量因子倾斜
      useCovariance = false,   // 是否使用协方差矩阵优化
      hybridRatio = 0,         // 混合策略比例：0=纯风险平价，0.3=70%风险平价+30%市值
      useMomentumTilt = false, // 是否使用动量因子倾斜
      momentumWindow = 6,      // 动量计算窗口（月）
      momentumWeight = 0.3,    // 动量因子权重
      enableStockFilter = false,  // 是否启用股票池筛选
      stockFilterParams = null    // 股票池筛选参数
    } = params;
    
    console.log(`\n🔧 计算风险平价权重 - 调仓日期: ${rebalanceDate}`);
    console.log(`📊 基础参数: 窗口=${volatilityWindow}月, EWMA=${ewmaDecay}, 最大权重=${maxWeight}`);
    console.log(`🚀 综合优化: 质量因子=${useQualityTilt}, 协方差=${useCovariance}, 混合比例=${hybridRatio}`);
    
    // 0. 股票池筛选（仅针对自定义策略）
    let filteredStocks = stocks;
    let removedStocks = [];
    if (enableStockFilter && stockFilterParams) {
      const filterResult = await stockFilterService.filterStocks(stocks, stockFilterParams, rebalanceDate);
      filteredStocks = filterResult.filteredStocks;
      removedStocks = filterResult.removedStocks;
      if (filteredStocks.length === 0) {
        console.warn(`⚠️  股票池筛选后无有效股票，使用原始股票池`);
        filteredStocks = stocks;
        removedStocks = [];
      }
    } else {
      console.log(`📋 未启用股票池筛选，使用全部${stocks.length}只股票`);
    }
    
    // 使用筛选后的股票列表进行后续计算
    stocks = filteredStocks;
    
    // 1. 批量获取所有股票的历史数据
    const tsCodes = stocks.map(s => s.con_code);
    
    // 计算开始日期（向前推volatilityWindow个月）
    const endDateObj = new Date(
      rebalanceDate.substring(0, 4),
      parseInt(rebalanceDate.substring(4, 6)) - 1,
      rebalanceDate.substring(6, 8)
    );
    const startDateObj = new Date(endDateObj);
    startDateObj.setMonth(startDateObj.getMonth() - volatilityWindow);
    
    const startDate = startDateObj.getFullYear() + 
      String(startDateObj.getMonth() + 1).padStart(2, '0') + 
      String(startDateObj.getDate()).padStart(2, '0');
    
    const expectedMinRecords = Math.floor(volatilityWindow * 20 * 0.8);
    
    // 批量获取数据（一次数据库查询获取所有股票数据）
    const stockDataMap = await tushareService.getStockDailyWithCacheBatch(
      tsCodes, 
      startDate, 
      rebalanceDate, 
      expectedMinRecords
    );
    
    // 2. 计算每只股票的波动率
    const stockVolatilities = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const stock of stocks) {
      const dailyData = stockDataMap[stock.con_code] || [];
      
      if (dailyData.length >= 2) {
        // 按日期升序排序
        dailyData.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
        
        // 计算日收益率
        const returns = [];
        for (let i = 1; i < dailyData.length; i++) {
          const prevClose = dailyData[i - 1].adj_close || dailyData[i - 1].close_price || dailyData[i - 1].close;
          const currClose = dailyData[i].adj_close || dailyData[i].close_price || dailyData[i].close;
          
          if (prevClose > 0 && currClose > 0) {
            returns.push((currClose - prevClose) / prevClose);
          }
        }
        
        if (returns.length > 0) {
          const volatility = this.calculateEWMAVolatility(returns, ewmaDecay);
          stockVolatilities.push({
            tsCode: stock.con_code,
            volatility: volatility,
            returns: returns
          });
          successCount++;
        } else {
          // 数据不足，使用默认波动率
          stockVolatilities.push({
            tsCode: stock.con_code,
            volatility: 0.02,
            returns: []
          });
          failCount++;
        }
      } else {
        // 如果没有数据，使用默认波动率
        stockVolatilities.push({
          tsCode: stock.con_code,
          volatility: 0.02, // 默认2%日波动率
          returns: []
        });
        failCount++;
      }
    }
    
    // console.log(`波动率计算完成: 成功${successCount}只, 失败${failCount}只`);
    
    // 输出波动率统计
    // const vols = stockVolatilities.map(s => s.volatility).filter(v => v > 0);
    // if (vols.length > 0) {
    //   console.log(`波动率统计: 最小=${(Math.min(...vols) * 100).toFixed(3)}%, 最大=${(Math.max(...vols) * 100).toFixed(3)}%, 平均=${(vols.reduce((a, b) => a + b, 0) / vols.length * 100).toFixed(3)}%`);
    // }
    
    // 2. 计算基础风险平价权重
    let riskParityWeights = {};
    
    if (useCovariance && stockVolatilities.length >= 2) {
      // 方案三：使用协方差矩阵优化
      riskParityWeights = this.calculateCovarianceBasedRiskParity(stockVolatilities, stocks, maxWeight);
    } else {
      // 标准风险平价：权重 ∝ 1/波动率
      const invVolatilities = stockVolatilities.map((s, idx) => {
        const stock = stocks[idx];
        let invVol = s.volatility > 0 ? 1 / s.volatility : 0;
        
        // 方案一：质量因子倾斜
        if (useQualityTilt && stock.dvRatio && stock.peTtm > 0) {
          // 高股息率、低PE的股票获得额外权重
          const qualityScore = stock.dvRatio * 10 + (stock.peTtm > 0 ? 1 / stock.peTtm : 0);
          const qualityMultiplier = 1 + Math.min(qualityScore * 0.1, 0.3); // 最多增加30%权重
          invVol *= qualityMultiplier;
        }
        
        return {
          tsCode: s.tsCode,
          invVol: invVol
        };
      });
      
      const totalInvVol = invVolatilities.reduce((sum, s) => sum + s.invVol, 0);
      
      // 归一化权重（初始）
      invVolatilities.forEach(s => {
        const weight = totalInvVol > 0 ? s.invVol / totalInvVol : 1 / stocks.length;
        riskParityWeights[s.tsCode] = weight;
      });
      
      // 应用maxWeight限制（迭代方法，确保限制生效）
      const maxIterations = 100;
      let iteration = 0;
      let totalCapped = 0;
      
      while (iteration < maxIterations) {
        let hasViolation = false;
        let excessWeight = 0;
        
        // 找出超过maxWeight的股票
        Object.keys(riskParityWeights).forEach(tsCode => {
          if (riskParityWeights[tsCode] > maxWeight) {
            excessWeight += riskParityWeights[tsCode] - maxWeight;
            riskParityWeights[tsCode] = maxWeight;
            hasViolation = true;
            totalCapped++;
          }
        });
        
        if (!hasViolation) break;
        
        // 将超出的权重重新分配给未达上限的股票
        const uncappedStocks = Object.keys(riskParityWeights).filter(
          tsCode => riskParityWeights[tsCode] < maxWeight
        );
        
        if (uncappedStocks.length === 0) break;
        
        const redistributeWeight = excessWeight / uncappedStocks.length;
        uncappedStocks.forEach(tsCode => {
          riskParityWeights[tsCode] += redistributeWeight;
        });
        
        iteration++;
      }
      
      if (totalCapped > 0) {
        console.log(`   ⚙️  应用maxWeight限制: ${totalCapped}只股票被限制在${(maxWeight * 100).toFixed(0)}%, 迭代${iteration}次`);
      }
      
      // 最终归一化
      const totalWeight = Object.values(riskParityWeights).reduce((sum, w) => sum + w, 0);
      if (totalWeight > 0) {
        Object.keys(riskParityWeights).forEach(tsCode => {
          riskParityWeights[tsCode] = riskParityWeights[tsCode] / totalWeight;
        });
      } else {
        // 如果总权重为0，使用等权重
        console.warn(`⚠️  风险平价权重总和为0，使用等权重分配`);
        Object.keys(riskParityWeights).forEach(tsCode => {
          riskParityWeights[tsCode] = 1 / stocks.length;
        });
      }
    }
    
    // 方案二：混合策略（如果启用）
    let finalWeights = riskParityWeights;
    if (hybridRatio > 0 && hybridRatio <= 1) {
      // 计算市值加权
      const marketCapWeights = this.calculateMarketCapWeightsFromStocks(stocks, maxWeight);
      
      // 混合：(1-hybridRatio)风险平价 + hybridRatio市值加权
      finalWeights = {};
      Object.keys(riskParityWeights).forEach(tsCode => {
        finalWeights[tsCode] = 
          (1 - hybridRatio) * riskParityWeights[tsCode] + 
          hybridRatio * (marketCapWeights[tsCode] || 0);
      });
      
      // 重新归一化
      const totalWeight = Object.values(finalWeights).reduce((sum, w) => sum + w, 0);
      if (totalWeight > 0) {
        Object.keys(finalWeights).forEach(tsCode => {
          finalWeights[tsCode] = finalWeights[tsCode] / totalWeight;
        });
      } else {
        console.warn(`⚠️  混合策略权重总和为0，使用等权重分配`);
        Object.keys(finalWeights).forEach(tsCode => {
          finalWeights[tsCode] = 1 / stocks.length;
        });
      }
    }
    
    // 方案一：动量因子倾斜（如果启用）
    if (useMomentumTilt && momentumWeight > 0) {
      console.log(`🚀 应用动量因子倾斜: 窗口=${momentumWindow}月, 权重=${momentumWeight}`);
      finalWeights = await this.applyMomentumTilt(finalWeights, stocks, rebalanceDate, momentumWindow, momentumWeight, maxWeight);
    }
    
    // console.log(`风险平价权重计算完成，共 ${Object.keys(finalWeights).length} 只股票`);
    // console.log(`权重范围: ${(Math.min(...Object.values(finalWeights)) * 100).toFixed(2)}% - ${(Math.max(...Object.values(finalWeights)) * 100).toFixed(2)}%`);
    
    // 返回权重和被筛选掉的股票信息
    return { weights: finalWeights, removedStocks };
  }

  /**
   * 基于协方差矩阵的风险平价权重计算
   * @param {Array} stockVolatilities - 股票波动率数据
   * @param {Array} stocks - 股票列表
   * @param {number} maxWeight - 最大权重限制
   * @returns {Object} 股票代码到权重的映射
   */
  calculateCovarianceBasedRiskParity(stockVolatilities, stocks, maxWeight) {
    // 构建收益率矩阵
    const returnsMatrix = [];
    const validStocks = [];
    
    stockVolatilities.forEach((sv, idx) => {
      if (sv.returns && sv.returns.length > 0) {
        returnsMatrix.push(sv.returns);
        validStocks.push(stocks[idx]);
      }
    });
    
    if (returnsMatrix.length < 2) {
      // 数据不足，降级为标准风险平价
      const weights = {};
      stockVolatilities.forEach((sv, idx) => {
        const invVol = sv.volatility > 0 ? 1 / sv.volatility : 0;
        weights[stocks[idx].con_code] = invVol;
      });
      
      // 初始归一化
      const totalInvVol = Object.values(weights).reduce((sum, w) => sum + w, 0);
      Object.keys(weights).forEach(code => {
        weights[code] = weights[code] / totalInvVol;
      });
      
      // 应用maxWeight限制（迭代方法）
      const maxIterations = 100;
      let iteration = 0;
      
      while (iteration < maxIterations) {
        let hasViolation = false;
        let excessWeight = 0;
        
        Object.keys(weights).forEach(code => {
          if (weights[code] > maxWeight) {
            excessWeight += weights[code] - maxWeight;
            weights[code] = maxWeight;
            hasViolation = true;
          }
        });
        
        if (!hasViolation) break;
        
        const uncappedStocks = Object.keys(weights).filter(code => weights[code] < maxWeight);
        if (uncappedStocks.length === 0) break;
        
        const redistributeWeight = excessWeight / uncappedStocks.length;
        uncappedStocks.forEach(code => {
          weights[code] += redistributeWeight;
        });
        
        iteration++;
      }
      
      // 最终归一化
      const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
      Object.keys(weights).forEach(code => {
        weights[code] = weights[code] / totalWeight;
      });
      
      return weights;
    }
    
    // 计算协方差矩阵
    const n = returnsMatrix.length;
    const means = returnsMatrix.map(returns => 
      returns.reduce((sum, r) => sum + r, 0) / returns.length
    );
    
    const covMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const returns_i = returnsMatrix[i];
        const returns_j = returnsMatrix[j];
        const minLen = Math.min(returns_i.length, returns_j.length);
        
        let cov = 0;
        for (let k = 0; k < minLen; k++) {
          cov += (returns_i[k] - means[i]) * (returns_j[k] - means[j]);
        }
        covMatrix[i][j] = cov / minLen;
      }
    }
    
    // 基于协方差矩阵计算风险平价权重
    const volatilities = covMatrix.map((row, i) => Math.sqrt(row[i]));
    const invVols = volatilities.map(v => v > 0 ? 1 / v : 0);
    const totalInvVol = invVols.reduce((sum, v) => sum + v, 0);
    
    const weights = {};
    validStocks.forEach((stock, i) => {
      let weight = totalInvVol > 0 ? invVols[i] / totalInvVol : 1 / n;
      weight = Math.min(weight, maxWeight);
      weights[stock.con_code] = weight;
    });
    
    // 归一化
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    Object.keys(weights).forEach(code => {
      weights[code] = weights[code] / totalWeight;
    });
    
    return weights;
  }

  /**
   * 从股票列表计算市值加权
   * @param {Array} stocks - 股票列表
   * @param {number} maxWeight - 最大权重限制
   * @returns {Object} 股票代码到权重的映射
   */
  calculateMarketCapWeightsFromStocks(stocks, maxWeight) {
    const weights = {};
    let totalMarketCap = 0;
    
    // 计算总市值
    stocks.forEach(stock => {
      const marketCap = stock.totalMv || 0;
      totalMarketCap += marketCap;
    });
    
    // 计算权重
    stocks.forEach(stock => {
      const marketCap = stock.totalMv || 0;
      let weight = totalMarketCap > 0 ? marketCap / totalMarketCap : 1 / stocks.length;
      weight = Math.min(weight, maxWeight);
      weights[stock.con_code] = weight;
    });
    
    // 归一化
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    Object.keys(weights).forEach(code => {
      weights[code] = weights[code] / totalWeight;
    });
    
    return weights;
  }

  /**
   * 生成更高频率的调仓日期
   * @param {Array} baseRebalanceDates - 基础调仓日期（年度）
   * @param {string} frequency - 频率：'quarterly' 或 'monthly'
   * @param {string} userEndDate - 用户选择的结束日期（可选）
   * @returns {Array} 新的调仓日期列表
   */
  generateHighFrequencyRebalanceDates(baseRebalanceDates, frequency, userEndDate = null) {
    if (frequency === 'yearly') {
      return baseRebalanceDates;
    }
    
    if (baseRebalanceDates.length === 0) {
      return [];
    }
    
    const newDates = [];
    const monthsToAdd = frequency === 'quarterly' ? 3 : 1;
    
    // 遍历每两个年度调仓日期之间，插入高频调仓日期
    for (let i = 0; i < baseRebalanceDates.length - 1; i++) {
      const startDate = baseRebalanceDates[i];
      const endDate = baseRebalanceDates[i + 1];
      
      // 添加起始年度调仓日期
      newDates.push(startDate);
      
      const startDateObj = new Date(
        startDate.substring(0, 4),
        parseInt(startDate.substring(4, 6)) - 1,
        startDate.substring(6, 8)
      );
      
      const endDateObj = new Date(
        endDate.substring(0, 4),
        parseInt(endDate.substring(4, 6)) - 1,
        endDate.substring(6, 8)
      );
      
      // 在两个年度调仓日期之间插入高频调仓日期
      let currentDate = new Date(startDateObj);
      currentDate.setMonth(currentDate.getMonth() + monthsToAdd);
      
      while (currentDate < endDateObj) {
        const dateStr = currentDate.getFullYear() + 
          String(currentDate.getMonth() + 1).padStart(2, '0') + 
          String(currentDate.getDate()).padStart(2, '0');
        newDates.push(dateStr);
        currentDate.setMonth(currentDate.getMonth() + monthsToAdd);
      }
    }
    
    // 添加最后一个年度调仓日期
    const lastYearlyDate = baseRebalanceDates[baseRebalanceDates.length - 1];
    newDates.push(lastYearlyDate);
    
    // 如果提供了用户结束日期，继续生成到结束日期为止的调仓日期
    if (userEndDate && userEndDate > lastYearlyDate) {
      const lastDateObj = new Date(
        lastYearlyDate.substring(0, 4),
        parseInt(lastYearlyDate.substring(4, 6)) - 1,
        lastYearlyDate.substring(6, 8)
      );
      
      const userEndDateObj = new Date(
        userEndDate.substring(0, 4),
        parseInt(userEndDate.substring(4, 6)) - 1,
        userEndDate.substring(6, 8)
      );
      
      let currentDate = new Date(lastDateObj);
      currentDate.setMonth(currentDate.getMonth() + monthsToAdd);
      
      while (currentDate < userEndDateObj) {
        const dateStr = currentDate.getFullYear() + 
          String(currentDate.getMonth() + 1).padStart(2, '0') + 
          String(currentDate.getDate()).padStart(2, '0');
        newDates.push(dateStr);
        currentDate.setMonth(currentDate.getMonth() + monthsToAdd);
      }
      
      console.log(`   📅 从最后年度调仓日期 ${lastYearlyDate} 继续生成到用户结束日期 ${userEndDate}`);
    }
    
    console.log(`   生成调仓日期详情: ${newDates.join(', ')}`);
    
    return newDates;
  }

  /**
   * 计算交易成本
   * @param {Object} oldWeights - 旧权重
   * @param {Object} newWeights - 新权重
   * @param {number} tradingCostRate - 交易成本率
   * @returns {number} 交易成本
   */
  calculateTradingCost(oldWeights, newWeights, tradingCostRate) {
    if (!oldWeights || Object.keys(oldWeights).length === 0) {
      // 首次建仓，所有权重都是买入
      return Object.values(newWeights).reduce((sum, w) => sum + w, 0) * tradingCostRate;
    }
    
    // 计算权重变化的绝对值之和（换手率）
    const allCodes = new Set([...Object.keys(oldWeights), ...Object.keys(newWeights)]);
    let turnover = 0;
    
    allCodes.forEach(code => {
      const oldWeight = oldWeights[code] || 0;
      const newWeight = newWeights[code] || 0;
      turnover += Math.abs(newWeight - oldWeight);
    });
    
    // 交易成本 = 换手率 × 成本率
    return turnover * tradingCostRate;
  }

  /**
   * 应用动量因子倾斜
   * @param {Object} baseWeights - 基础权重（风险平价或混合权重）
   * @param {Array} stocks - 股票列表
   * @param {string} rebalanceDate - 调仓日期
   * @param {number} momentumWindow - 动量窗口（月）
   * @param {number} momentumWeight - 动量因子权重（0-1）
   * @param {number} maxWeight - 最大权重限制
   * @returns {Object} 应用动量倾斜后的权重
   */
  async applyMomentumTilt(baseWeights, stocks, rebalanceDate, momentumWindow, momentumWeight, maxWeight) {
    // 计算动量开始日期
    const endDateObj = new Date(
      rebalanceDate.substring(0, 4),
      parseInt(rebalanceDate.substring(4, 6)) - 1,
      rebalanceDate.substring(6, 8)
    );
    const startDateObj = new Date(endDateObj);
    startDateObj.setMonth(startDateObj.getMonth() - momentumWindow);
    
    const startDate = startDateObj.getFullYear() + 
      String(startDateObj.getMonth() + 1).padStart(2, '0') + 
      String(startDateObj.getDate()).padStart(2, '0');
    
    // 批量获取股票价格数据
    const stockCodes = stocks.map(s => s.con_code);
    const pricesData = await tushareService.batchGetStockPrices(stockCodes, startDate, rebalanceDate);
    
    // 计算每只股票的动量得分
    const momentumScores = {};
    for (const stock of stocks) {
      const prices = pricesData[stock.con_code];
      if (!prices || prices.length < 2) {
        momentumScores[stock.con_code] = 0;
        continue;
      }
      
      const firstPrice = prices[0].close;
      const lastPrice = prices[prices.length - 1].close;
      const momentum = (lastPrice - firstPrice) / firstPrice;
      momentumScores[stock.con_code] = momentum;
    }
    
    // 将动量得分标准化到0-1范围（使用min-max归一化）
    const momentumValues = Object.values(momentumScores);
    const minMomentum = Math.min(...momentumValues);
    const maxMomentum = Math.max(...momentumValues);
    const momentumRange = maxMomentum - minMomentum;
    
    const normalizedMomentum = {};
    if (momentumRange > 0) {
      Object.keys(momentumScores).forEach(code => {
        normalizedMomentum[code] = (momentumScores[code] - minMomentum) / momentumRange;
      });
    } else {
      // 如果所有动量相同，设为0.5
      Object.keys(momentumScores).forEach(code => {
        normalizedMomentum[code] = 0.5;
      });
    }
    
    // 应用动量倾斜：新权重 = (1-momentumWeight) * 基础权重 + momentumWeight * 动量得分
    const tiltedWeights = {};
    Object.keys(baseWeights).forEach(code => {
      const baseWeight = baseWeights[code];
      const momentum = normalizedMomentum[code] || 0.5;
      // 动量倾斜：高动量股票获得更高权重
      tiltedWeights[code] = baseWeight * (1 + momentumWeight * (momentum - 0.5) * 2);
    });
    
    // 应用最大权重限制
    Object.keys(tiltedWeights).forEach(code => {
      tiltedWeights[code] = Math.min(tiltedWeights[code], maxWeight);
    });
    
    // 重新归一化
    const totalWeight = Object.values(tiltedWeights).reduce((sum, w) => sum + w, 0);
    Object.keys(tiltedWeights).forEach(code => {
      tiltedWeights[code] = tiltedWeights[code] / totalWeight;
    });
    
    // 输出动量倾斜效果
    const topMomentum = Object.entries(momentumScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    console.log(`   📈 动量最高的3只股票:`);
    topMomentum.forEach(([code, momentum]) => {
      const stock = stocks.find(s => s.con_code === code);
      const name = stock?.name || code;
      console.log(`      ${name}: ${(momentum * 100).toFixed(2)}%`);
    });
    
    return tiltedWeights;
  }
}

module.exports = new IndexPortfolioService();
