const tushareService = require('./tushareService');

/**
 * 市场温度计服务（基于指数PE/PB估值）
 * 
 * 核心原则：
 * 1. 数据源：Tushare index_dailybasic接口，获取指数官方PE/PB
 * 2. 参考指数：沪深300（代表大盘蓝筹）
 * 3. 历史周期：20年数据（2005-2025），覆盖多轮牛熊
 * 4. 温度计算：基于PE/PB的历史分位数
 * 5. 温度分级：低估(0-30°)、中估(30-70°)、高估(70-100°)
 */
class MarketThermometerService {
  
  constructor() {
    // 默认使用沪深300指数
    this.defaultIndex = '000300.SH';
    // 历史数据起始日期（2005年沪深300发布）
    this.defaultStartDate = '20050101';
    
    // 多指数配置（用于综合温度计算）
    this.multiIndexConfig = [
      { code: '000300.SH', name: '沪深300', weight: 0.35, startDate: '20050101' },  // 大盘蓝筹
      { code: '000905.SH', name: '中证500', weight: 0.30, startDate: '20070115' },  // 中盘成长
      { code: '000852.SH', name: '中证1000', weight: 0.20, startDate: '20141017' }, // 小盘
      { code: '000016.SH', name: '上证50', weight: 0.15, startDate: '20040102' }    // 超大盘
    ];
  }
  
  /**
   * 计算市场温度（基于指数PE/PB）
   * @param {string} indexCode - 指数代码（默认000300.SH）
   * @param {string} date - 日期（YYYYMMDD）
   * @returns {Object} 温度结果
   */
  async calculateMarketTemperature(indexCode = null, date = null) {
    try {
      const tsCode = indexCode || this.defaultIndex;
      const tradeDate = date || this.getTodayDate();
      
      console.log(`\n🌡️ 开始计算市场温度 [${tsCode}] [${tradeDate}]`);
      
      // 1. 获取历史PE/PB数据
      const startDate = this.defaultStartDate;
      const historicalData = await tushareService.getIndexDailybasic(tsCode, startDate, tradeDate);
      
      if (!historicalData || historicalData.length === 0) {
        console.warn(`⚠️ 无历史数据，使用默认值50°`);
        return this.getDefaultTemperature(tradeDate);
      }
      
      console.log(`   获取到 ${historicalData.length} 天历史数据`);
      
      // 2. 过滤有效数据
      const validData = historicalData.filter(d => {
        const pe = parseFloat(d.pe_ttm || d.pe);
        const pb = parseFloat(d.pb);
        return pe > 0 && pe < 200 && pb > 0 && pb < 50;
      });
      
      if (validData.length < 100) {
        console.warn(`⚠️ 有效数据不足100天，使用默认值50°`);
        return this.getDefaultTemperature(tradeDate);
      }
      
      console.log(`   有效数据: ${validData.length} 天`);
      
      // 3. 获取当前日期的数据，如果没有则使用最近的日期
      let currentData = validData.find(d => d.trade_date === tradeDate);
      let actualDate = tradeDate;
      
      if (!currentData) {
        // 查找最近的有效日期（小于等于目标日期）
        const sortedData = validData
          .filter(d => d.trade_date <= tradeDate)
          .sort((a, b) => b.trade_date.localeCompare(a.trade_date));
        
        if (sortedData.length > 0) {
          currentData = sortedData[0];
          actualDate = currentData.trade_date;
          console.log(`   ℹ️ 当前日期 ${tradeDate} 无数据，使用最近日期 ${actualDate}`);
        } else {
          console.warn(`⚠️ 无可用数据，使用默认值50°`);
          return this.getDefaultTemperature(tradeDate);
        }
      }
      
      const currentPE = parseFloat(currentData.pe_ttm || currentData.pe);
      const currentPB = parseFloat(currentData.pb);
      
      // 4. 计算PE温度
      const peTemp = this.calculatePercentileTemperature(
        currentPE,
        validData.map(d => parseFloat(d.pe_ttm || d.pe))
      );
      
      // 5. 计算PB温度
      const pbTemp = this.calculatePercentileTemperature(
        currentPB,
        validData.map(d => parseFloat(d.pb))
      );
      
      // 6. 综合温度（PE和PB等权）
      const temperature = Math.round((peTemp + pbTemp) / 2);
      
      // 7. 温度分级
      const level = this.getTemperatureLevel(temperature);
      
      // 8. 计算置信度
      const confidence = this.calculateConfidence(peTemp, pbTemp);
      
      const result = {
        temperature,
        level: level.code,
        levelName: level.name,
        levelDescription: this.getLevelDescription(level.code),
        color: this.getLevelColor(level.code),
        suggestion: level.suggestion,
        confidence,
        components: {
          pe: Math.round(peTemp),
          pb: Math.round(pbTemp)
        },
        values: {
          pe: currentPE,
          pb: currentPB
        },
        params: this.getStrategyParams(level.code),
        warning: this.getWarning(temperature, level.code),
        date: tradeDate,
        indexCode: tsCode,
        dataPoints: validData.length
      };
      
      console.log(`✅ 市场温度: ${result.temperature}° (${result.levelName})`);
      console.log(`   PE: ${currentPE.toFixed(2)} (温度${result.components.pe}°)`);
      console.log(`   PB: ${currentPB.toFixed(2)} (温度${result.components.pb}°)`);
      console.log(`   置信度: ${(confidence * 100).toFixed(0)}%`);
      
      return result;
    } catch (error) {
      console.error('计算市场温度失败:', error.message);
      return this.getDefaultTemperature(date);
    }
  }
  
  /**
   * 计算分位数温度
   * @param {number} current - 当前值
   * @param {Array} historical - 历史值数组
   * @returns {number} 温度（0-100）
   */
  calculatePercentileTemperature(current, historical) {
    // 排序
    const sorted = historical.sort((a, b) => a - b);
    
    // 计算严格小于当前值的数量
    const rank = sorted.filter(v => v < current).length;
    
    // 计算分位数（使用中位数无偏估计）
    const percentile = (rank + 0.5) / sorted.length;
    
    // 转换为温度（0-100），四舍五入到整数
    const temperature = Math.round(percentile * 100);
    
    // 确保在0-100范围内
    return Math.min(100, Math.max(0, temperature));
  }
  
  /**
   * 计算历史温度序列
   * @param {string} indexCode - 指数代码
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Array} 温度序列
   */
  async calculateHistoricalTemperature(indexCode = null, startDate = null, endDate = null) {
    try {
      const tsCode = indexCode || this.defaultIndex;
      const actualStartDate = startDate || '20200101'; // 默认近5年
      const actualEndDate = endDate || this.getTodayDate();
      
      console.log(`\n📊 计算历史温度序列 [${tsCode}] [${actualStartDate} - ${actualEndDate}]`);
      
      // 获取历史数据（从2005年开始，确保有足够的历史基准）
      const allData = await tushareService.getIndexDailybasic(tsCode, this.defaultStartDate, actualEndDate);
      
      if (!allData || allData.length === 0) {
        console.warn('无历史数据');
        return [];
      }
      
      // 过滤有效数据
      const validData = allData.filter(d => {
        const pe = parseFloat(d.pe_ttm || d.pe);
        const pb = parseFloat(d.pb);
        return pe > 0 && pe < 200 && pb > 0 && pb < 50;
      });
      
      // 筛选需要计算温度的日期范围
      const targetData = validData.filter(d => d.trade_date >= actualStartDate && d.trade_date <= actualEndDate);
      
      console.log(`   历史基准数据: ${validData.length} 天`);
      console.log(`   目标日期范围: ${targetData.length} 天`);
      
      const temperatures = [];
      
      // 为每个目标日期计算温度
      for (const item of targetData) {
        const currentPE = parseFloat(item.pe_ttm || item.pe);
        const currentPB = parseFloat(item.pb);
        
        // 使用截至当前日期的所有历史数据计算分位数
        const historicalUpToDate = validData.filter(d => d.trade_date <= item.trade_date);
        
        const peTemp = this.calculatePercentileTemperature(
          currentPE,
          historicalUpToDate.map(d => parseFloat(d.pe_ttm || d.pe))
        );
        
        const pbTemp = this.calculatePercentileTemperature(
          currentPB,
          historicalUpToDate.map(d => parseFloat(d.pb))
        );
        
        const temperature = Math.round((peTemp + pbTemp) / 2);
        const level = this.getTemperatureLevel(temperature);
        
        temperatures.push({
          date: item.trade_date,
          temperature,
          level: level.code,
          levelName: level.name,
          components: {
            pe: Math.round(peTemp),
            pb: Math.round(pbTemp)
          },
          values: {
            pe: currentPE,
            pb: currentPB
          }
        });
      }
      
      console.log(`✅ 计算完成，共 ${temperatures.length} 个温度点`);
      return temperatures;
    } catch (error) {
      console.error('计算历史温度失败:', error.message);
      return [];
    }
  }
  
  /**
   * 计算温度分布统计
   */
  calculateTemperatureDistribution(temperatures) {
    if (!temperatures || temperatures.length === 0) {
      return null;
    }
    
    const distribution = {
      cold: 0,        // 0-30°（低估）
      normal: 0,      // 30-70°（中估）
      hot: 0          // 70-100°（高估）
    };
    
    temperatures.forEach(t => {
      const temp = t.temperature;
      if (temp < 30) distribution.cold++;
      else if (temp < 70) distribution.normal++;
      else distribution.hot++;
    });
    
    const total = temperatures.length;
    const avgTemp = (temperatures.reduce((sum, t) => sum + t.temperature, 0) / total).toFixed(1);
    
    return {
      cold: { 
        count: distribution.cold, 
        percentage: (distribution.cold / total * 100).toFixed(1),
        description: '低估区间，买入最佳时机'
      },
      normal: { 
        count: distribution.normal, 
        percentage: (distribution.normal / total * 100).toFixed(1),
        description: '中估区间，适度买入'
      },
      hot: { 
        count: distribution.hot, 
        percentage: (distribution.hot / total * 100).toFixed(1),
        description: '高估区间，谨慎或减仓'
      },
      total,
      average: avgTemp,
      avgTemperature: avgTemp
    };
  }
  
  /**
   * 温度分级
   */
  getTemperatureLevel(temperature) {
    let code, name, suggestion;
    
    if (temperature < 30) {
      code = 'COLD';
      name = '低估';
      suggestion = '💰 买入最佳时机 - 市场处于低估状态，建议积极配置';
    } else if (temperature < 70) {
      code = 'NORMAL';
      name = '中估';
      suggestion = '⚖️ 合理估值 - 市场处于适中状态，适度配置';
    } else {
      code = 'HOT';
      name = '高估';
      suggestion = '⚠️ 谨慎减仓 - 市场处于高估状态，控制风险';
    }
    
    return { code, name, suggestion };
  }
  
  /**
   * 获取温度级别名称
   */
  getLevelName(level) {
    const names = {
      COLD: '低估',
      NORMAL: '中估',
      HOT: '高估'
    };
    return names[level] || '未知';
  }
  
  /**
   * 获取温度级别描述
   */
  getLevelDescription(level) {
    const descriptions = {
      COLD: '温度偏冷 - 市场处于低估状态，买入最佳时机',
      NORMAL: '温度适中 - 市场处于合理估值，适度买入',
      HOT: '温度过热 - 市场处于高估状态，谨慎或减仓'
    };
    return descriptions[level] || '';
  }
  
  /**
   * 获取温度颜色
   */
  getLevelColor(level) {
    const colors = {
      COLD: '#3b82f6',      // 蓝色
      NORMAL: '#fbbf24',    // 黄色
      HOT: '#ef4444'        // 红色
    };
    return colors[level] || '#6b7280';
  }
  
  /**
   * 获取策略建议
   */
  getSuggestion(level) {
    const suggestions = {
      COLD: '✅ 低估买入 - 历史数据显示，低估时买入，长期持有效果最好。建议积极买入，加大仓位。',
      NORMAL: '⚖️ 适度买入 - 市场处于合理估值，可以正常配置，保持均衡策略。',
      HOT: '⚠️ 谨慎减仓 - 市场处于高估状态，建议降低仓位，甚至考虑逐步兑现收益。'
    };
    return suggestions[level] || '';
  }
  
  /**
   * 获取温度预警
   */
  getWarning(temperature, level) {
    const warnings = [];
    
    if (temperature < 20) {
      warnings.push({
        type: 'opportunity',
        level: 'high',
        message: '🎯 极佳买入机会！温度低于20°，历史数据显示此时买入长期收益最佳'
      });
    } else if (temperature < 30) {
      warnings.push({
        type: 'opportunity',
        level: 'medium',
        message: '✅ 良好买入时机，温度处于低估区间'
      });
    }
    
    if (temperature > 80) {
      warnings.push({
        type: 'risk',
        level: 'high',
        message: '⚠️ 高风险警告！温度超过80°，建议减仓观望'
      });
    } else if (temperature > 70) {
      warnings.push({
        type: 'risk',
        level: 'medium',
        message: '⚠️ 市场过热，建议降低仓位'
      });
    }
    
    return warnings;
  }
  
  /**
   * 获取策略参数建议
   */
  getStrategyParams(level) {
    const paramsMap = {
      COLD: {
        maxWeight: 0.20,
        volatilityWindow: 6,
        minROE: 0,
        maxDebtRatio: 1,
        filterByQuality: false,
        description: '积极进攻 - 低估时加大仓位'
      },
      NORMAL: {
        maxWeight: 0.15,
        volatilityWindow: 6,
        minROE: 0,
        maxDebtRatio: 1,
        filterByQuality: false,  // 关闭质量筛选，避免持仓过度集中
        description: '均衡配置 - 正常持有'
      },
      HOT: {
        maxWeight: 0.10,
        volatilityWindow: 12,
        minROE: 0.02,            // 降低到2%，更适合红利股
        maxDebtRatio: 0.8,
        filterByQuality: false,  // 关闭质量筛选，避免持仓过度集中
        description: '谨慎防守 - 高估时降低仓位'
      }
    };
    
    return paramsMap[level] || paramsMap.NORMAL;
  }
  
  /**
   * 计算置信度
   */
  calculateConfidence(peTemp, pbTemp) {
    // PE和PB温度的一致性越高，置信度越高
    const diff = Math.abs(peTemp - pbTemp);
    const confidence = Math.max(0, Math.min(1, 1 - diff / 100));
    return confidence;
  }
  
  /**
   * 获取默认温度
   */
  getDefaultTemperature(date) {
    return {
      temperature: 50,
      level: 'NORMAL',
      levelName: '中估',
      levelDescription: '温度适中 - 数据不足，使用默认值',
      color: '#fbbf24',
      suggestion: '⚖️ 适度买入 - 市场处于合理估值',
      confidence: 0,
      components: {
        pe: 50,
        pb: 50
      },
      values: {
        pe: null,
        pb: null
      },
      params: this.getStrategyParams('NORMAL'),
      warning: [],
      date,
      dataPoints: 0
    };
  }
  
  /**
   * 获取今天日期
   */
  getTodayDate() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
  
  /**
   * 计算多指数综合温度
   * @param {string} date - 日期（YYYYMMDD）
   * @returns {Object} 综合温度结果
   */
  async calculateCompositeTemperature(date = null) {
    try {
      const tradeDate = date || this.getTodayDate();
      console.log(`\n🌡️ 开始计算多指数综合温度 [${tradeDate}]`);
      
      const indexTemperatures = [];
      let totalWeight = 0;
      let weightedTempSum = 0;
      
      // 计算每个指数的温度
      for (const indexConfig of this.multiIndexConfig) {
        try {
          const temp = await this.calculateMarketTemperature(indexConfig.code, tradeDate);
          
          if (temp && temp.temperature !== null) {
            indexTemperatures.push({
              code: indexConfig.code,
              name: indexConfig.name,
              weight: indexConfig.weight,
              temperature: temp.temperature,
              level: temp.level,
              levelName: temp.levelName,
              pe: temp.values.pe,
              pb: temp.values.pb,
              peTemp: temp.components.pe,
              pbTemp: temp.components.pb,
              confidence: temp.confidence
            });
            
            weightedTempSum += temp.temperature * indexConfig.weight;
            totalWeight += indexConfig.weight;
            
            console.log(`   ${indexConfig.name}: ${temp.temperature}° (权重${(indexConfig.weight * 100).toFixed(0)}%)`);
          }
        } catch (error) {
          console.warn(`   ⚠️ ${indexConfig.name} 温度计算失败: ${error.message}`);
        }
      }
      
      if (totalWeight === 0 || indexTemperatures.length === 0) {
        console.warn('⚠️ 无有效指数温度数据，返回默认值');
        return this.getDefaultTemperature(tradeDate);
      }
      
      // 计算加权平均温度
      const compositeTemp = Math.round(weightedTempSum / totalWeight);
      const level = this.getTemperatureLevel(compositeTemp);
      
      // 计算置信度（基于有效指数数量）
      const confidence = indexTemperatures.length / this.multiIndexConfig.length;
      
      console.log(`\n   📊 综合温度: ${compositeTemp}° (${level.name})`);
      console.log(`   📈 有效指数: ${indexTemperatures.length}/${this.multiIndexConfig.length}`);
      console.log(`   🎯 置信度: ${(confidence * 100).toFixed(0)}%`);
      
      return {
        temperature: compositeTemp,
        level: level.code,
        levelName: level.name,
        confidence: confidence,
        suggestion: level.suggestion,
        params: this.getStrategyParams(level.code),
        date: tradeDate,
        indexTemperatures: indexTemperatures,
        composition: {
          weightedAverage: compositeTemp,
          totalWeight: totalWeight,
          validIndices: indexTemperatures.length,
          totalIndices: this.multiIndexConfig.length
        }
      };
    } catch (error) {
      console.error('计算多指数综合温度失败:', error);
      return this.getDefaultTemperature(date);
    }
  }
  
  /**
   * 计算多指数历史温度序列
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Object} 包含所有指数的历史温度数据
   */
  async calculateMultiIndexHistoricalTemperature(startDate, endDate) {
    try {
      console.log(`\n📊 开始计算多指数历史温度 [${startDate} - ${endDate}]`);
      
      const result = {
        startDate,
        endDate,
        indices: {}
      };
      
      // 为每个指数计算历史温度
      for (const indexConfig of this.multiIndexConfig) {
        try {
          console.log(`\n   计算 ${indexConfig.name} 历史温度...`);
          const temps = await this.calculateHistoricalTemperature(indexConfig.code, startDate, endDate);
          
          result.indices[indexConfig.code] = {
            name: indexConfig.name,
            weight: indexConfig.weight,
            temperatures: temps,
            distribution: this.calculateTemperatureDistribution(temps)
          };
          
          console.log(`   ✅ ${indexConfig.name}: ${temps.length} 个数据点`);
        } catch (error) {
          console.warn(`   ⚠️ ${indexConfig.name} 历史温度计算失败: ${error.message}`);
        }
      }
      
      // 计算综合温度序列
      const compositeTempSeries = this.calculateCompositeTemperatureSeries(result.indices);
      result.composite = {
        name: '综合温度',
        temperatures: compositeTempSeries,
        distribution: this.calculateTemperatureDistribution(compositeTempSeries)
      };
      
      console.log(`\n✅ 多指数历史温度计算完成`);
      console.log(`   综合温度数据点: ${compositeTempSeries.length}`);
      
      return result;
    } catch (error) {
      console.error('计算多指数历史温度失败:', error);
      throw error;
    }
  }
  
  /**
   * 计算综合温度序列（从各指数温度数据中）
   */
  calculateCompositeTemperatureSeries(indicesData) {
    const dateMap = new Map();
    
    // 收集所有日期的温度数据
    for (const [code, data] of Object.entries(indicesData)) {
      if (!data.temperatures) continue;
      
      data.temperatures.forEach(temp => {
        if (!dateMap.has(temp.date)) {
          dateMap.set(temp.date, []);
        }
        dateMap.get(temp.date).push({
          temperature: temp.temperature,
          weight: data.weight
        });
      });
    }
    
    // 计算每个日期的加权平均温度
    const compositeSeries = [];
    for (const [date, temps] of dateMap.entries()) {
      let weightedSum = 0;
      let totalWeight = 0;
      
      temps.forEach(t => {
        weightedSum += t.temperature * t.weight;
        totalWeight += t.weight;
      });
      
      if (totalWeight > 0) {
        const avgTemp = Math.round(weightedSum / totalWeight);
        const levelObj = this.getTemperatureLevel(avgTemp);
        
        compositeSeries.push({
          date: date,
          temperature: avgTemp,
          level: levelObj.code,
          levelName: levelObj.name
        });
      }
    }
    
    // 按日期排序
    compositeSeries.sort((a, b) => a.date.localeCompare(b.date));
    
    return compositeSeries;
  }
}

module.exports = new MarketThermometerService();
