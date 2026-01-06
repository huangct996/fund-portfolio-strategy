const tushareService = require('./tushareService');

/**
 * 市场温度计服务（基于有知有行设计理念）
 * 
 * 核心原则：
 * 1. 样本空间：指数所有成分股
 * 2. 计算指标：PE和PB估值的等权平均
 * 3. 考察周期：2轮完整牛熊周期（约10年）
 * 4. 温度分级：低估(0-30°)、中估(30-70°)、高估(70-100°)
 * 5. 应用场景：大周期择时，追求模糊的准确
 */
class MarketThermometerService {
  
  /**
   * 计算市场温度（基于PE/PB估值）
   */
  async calculateMarketTemperature(indexCode, date, stocks = null) {
    try {
      console.log(`\n🌡️ 开始计算市场温度 [${indexCode}] [${date}]`);
      
      // 1. 计算PE/PB温度（核心指标）
      const peTemp = await this.calculatePETemperature(indexCode, date);
      const pbTemp = await this.calculatePBTemperature(indexCode, date);
      
      // 2. 综合PE和PB温度（等权）
      const temperature = (peTemp + pbTemp) / 2;
      
      // 3. 温度分级（三温带）
      const level = this.getTemperatureLevel(temperature);
      
      // 4. 计算置信度
      const confidence = this.calculateConfidence(peTemp, pbTemp);
      
      const result = {
        temperature: Math.round(temperature),
        level,
        levelName: this.getLevelName(level),
        levelDescription: this.getLevelDescription(level),
        color: this.getLevelColor(level),
        suggestion: this.getSuggestion(level),
        confidence: confidence,
        components: {
          pe: Math.round(peTemp),
          pb: Math.round(pbTemp)
        },
        params: this.getStrategyParams(level),
        warning: this.getWarning(temperature, level),
        date
      };
      
      console.log(`✅ 市场温度: ${result.temperature}° (${result.levelName})`);
      console.log(`   PE温度:${result.components.pe}° PB温度:${result.components.pb}°`);
      
      return result;
    } catch (error) {
      console.error('计算市场温度失败:', error.message);
      return this.getDefaultTemperature(date);
    }
  }
  
  /**
   * 计算PE温度
   * 基于10年历史PE分位数（2轮完整周期）
   * 使用成分股PE等权平均来计算指数PE
   */
  async calculatePETemperature(indexCode, date, stocks = null) {
    try {
      // 如果没有提供成分股列表，获取当前日期的成分股
      if (!stocks || stocks.length === 0) {
        stocks = await tushareService.getIndexWeightByDate(indexCode, date);
      }
      
      if (!stocks || stocks.length === 0) {
        console.warn(`   ⚠️ 无成分股数据，使用默认值50°`);
        return 50;
      }
      
      // 获取成分股代码列表
      const stockCodes = stocks.map(s => s.con_code);
      console.log(`   成分股数量: ${stockCodes.length}`);
      
      // 使用固定10年窗口（与有知有行一致）
      const dbService = require('./dbService');
      const startDate = this.getDateBefore(date, 3650); // 10年前
      
      console.log(`   计算PE温度: ${startDate} - ${date} (10年窗口)`);
      
      // 获取成分股的历史PE数据（从stock_basic_info表）
      const historicalData = await dbService.getStockBasicInfoBatch(stockCodes, startDate, date);
      
      if (!historicalData || historicalData.length === 0) {
        console.warn(`   ⚠️ 无成分股PE数据，使用默认值50°`);
        return 50;
      }
      
      // 按日期分组，计算每天的中位数PE（更稳健）
      const dateMap = new Map();
      historicalData.forEach(item => {
        // 转换为数字类型，过滤异常值
        const pe = parseFloat(item.pe_ttm);
        if (!pe || pe <= 0 || isNaN(pe) || pe > 200) return; // PE>200视为异常值
        
        if (!dateMap.has(item.trade_date)) {
          dateMap.set(item.trade_date, []);
        }
        dateMap.get(item.trade_date).push(pe);
      });
      
      // 计算每天的中位数PE（更稳健，不受极端值影响）
      const dailyPEs = [];
      dateMap.forEach((pes, date) => {
        if (pes.length >= stockCodes.length * 0.2) { // 至少有20%的成分股有数据
          // 排序后取中位数
          const sortedPEs = pes.sort((a, b) => a - b);
          const medianPE = sortedPEs.length % 2 === 0
            ? (sortedPEs[sortedPEs.length / 2 - 1] + sortedPEs[sortedPEs.length / 2]) / 2
            : sortedPEs[Math.floor(sortedPEs.length / 2)];
          dailyPEs.push({ date, pe: medianPE, count: pes.length });
        }
      });
      
      // 获取当前日期的PE
      const currentData = dailyPEs.find(d => d.date === date);
      if (!currentData) {
        console.warn(`   ⚠️ 当前日期无PE数据，使用默认值50°`);
        return 50;
      }
      
      const currentPE = currentData.pe;
      
      console.log(`   ✅ 有效PE数据: ${dailyPEs.length}天`);
      
      // 如果只有1天数据，无法计算分位数，使用50°
      if (dailyPEs.length < 2) {
        console.log(`   ⚠️ 数据不足以计算分位数，使用中位值50°`);
        return 50;
      }
      
      // 计算历史PE分位数（使用对数变换平滑）
      const historicalPEs = dailyPEs.map(d => d.pe).sort((a, b) => a - b);
      
      // 对PE值进行对数变换，使分布更均匀
      const minPE = historicalPEs[0];
      const maxPE = historicalPEs[historicalPEs.length - 1];
      
      // 使用对数空间计算分位数
      const logCurrentPE = Math.log(currentPE / minPE);
      const logMaxPE = Math.log(maxPE / minPE);
      
      // 计算对数空间的分位数
      let logPercentile = logCurrentPE / logMaxPE;
      
      // 如果当前PE超过历史最大值，使用外推但限制上限
      if (currentPE > maxPE) {
        const extraRatio = (currentPE - maxPE) / maxPE;
        logPercentile = 1 + extraRatio * 0.1; // 超出部分只增加10%的权重
      }
      
      // 限制分位数范围，避免极端值
      logPercentile = Math.min(0.95, Math.max(0.05, logPercentile));
      
      const temperature = logPercentile * 100;
      
      console.log(`   当前PE: ${currentPE.toFixed(2)}, 历史范围: ${historicalPEs[0].toFixed(2)} - ${historicalPEs[historicalPEs.length-1].toFixed(2)}`);
      console.log(`   PE温度: ${temperature.toFixed(1)}° (对数分位数: ${(logPercentile * 100).toFixed(1)}%)`);
      return temperature;
    } catch (error) {
      console.warn('计算PE温度失败:', error.message);
      console.error(error.stack);
      return 50;
    }
  }
  
  /**
   * 计算PB温度
   * 基于10年历史PB分位数
   * 使用成分股PB等权平均来计算指数PB
   */
  async calculatePBTemperature(indexCode, date, stocks = null) {
    try {
      // 如果没有提供成分股列表，获取当前日期的成分股
      if (!stocks || stocks.length === 0) {
        stocks = await tushareService.getIndexWeightByDate(indexCode, date);
      }
      
      if (!stocks || stocks.length === 0) {
        console.warn(`   ⚠️ 无成分股数据，使用默认值50°`);
        return 50;
      }
      
      // 获取成分股代码列表
      const stockCodes = stocks.map(s => s.con_code);
      console.log(`   成分股数量: ${stockCodes.length}`);
      
      // 使用固定10年窗口（与有知有行一致）
      const dbService = require('./dbService');
      const startDate = this.getDateBefore(date, 3650); // 10年前
      
      console.log(`   计算PB温度: ${startDate} - ${date} (10年窗口)`);
      
      // 获取成分股的历史PB数据（从stock_basic_info表）
      const historicalData = await dbService.getStockBasicInfoBatch(stockCodes, startDate, date);
      
      if (!historicalData || historicalData.length === 0) {
        console.warn(`   ⚠️ 无成分股PB数据，使用默认值50°`);
        return 50;
      }
      
      // 按日期分组，计算每天的中位数PB（更稳健）
      const dateMap = new Map();
      historicalData.forEach(item => {
        // 转换为数字类型，过滤异常值
        const pb = parseFloat(item.pb);
        if (!pb || pb <= 0 || isNaN(pb) || pb > 50) return; // PB>50视为异常值
        
        if (!dateMap.has(item.trade_date)) {
          dateMap.set(item.trade_date, []);
        }
        dateMap.get(item.trade_date).push(pb);
      });
      
      // 计算每天的中位数PB（更稳健，不受极端值影响）
      const dailyPBs = [];
      dateMap.forEach((pbs, date) => {
        if (pbs.length >= stockCodes.length * 0.2) { // 至少有20%的成分股有数据
          // 排序后取中位数
          const sortedPBs = pbs.sort((a, b) => a - b);
          const medianPB = sortedPBs.length % 2 === 0
            ? (sortedPBs[sortedPBs.length / 2 - 1] + sortedPBs[sortedPBs.length / 2]) / 2
            : sortedPBs[Math.floor(sortedPBs.length / 2)];
          dailyPBs.push({ date, pb: medianPB, count: pbs.length });
        }
      });
      
      // 获取当前日期的PB
      const currentData = dailyPBs.find(d => d.date === date);
      if (!currentData) {
        console.warn(`   ⚠️ 当前日期无PB数据，使用默认值50°`);
        return 50;
      }
      
      const currentPB = currentData.pb;
      
      console.log(`   ✅ 有效PB数据: ${dailyPBs.length}天`);
      
      // 如果只有1天数据，无法计算分位数，使用50°
      if (dailyPBs.length < 2) {
        console.log(`   ⚠️ 数据不足以计算分位数，使用中位值50°`);
        return 50;
      }
      
      // 计算历史PB分位数（使用对数变换平滑）
      const historicalPBs = dailyPBs.map(d => d.pb).sort((a, b) => a - b);
      
      // 对PB值进行对数变换，使分布更均匀
      const minPB = historicalPBs[0];
      const maxPB = historicalPBs[historicalPBs.length - 1];
      
      // 使用对数空间计算分位数
      const logCurrentPB = Math.log(currentPB / minPB);
      const logMaxPB = Math.log(maxPB / minPB);
      
      // 计算对数空间的分位数
      let logPercentile = logCurrentPB / logMaxPB;
      
      // 如果当前PB超过历史最大值，使用外推但限制上限
      if (currentPB > maxPB) {
        const extraRatio = (currentPB - maxPB) / maxPB;
        logPercentile = 1 + extraRatio * 0.1; // 超出部分只增加10%的权重
      }
      
      // 限制分位数范围，避免极端值
      logPercentile = Math.min(0.95, Math.max(0.05, logPercentile));
      
      const temperature = logPercentile * 100;
      
      console.log(`   当前PB: ${currentPB.toFixed(2)}, 历史范围: ${historicalPBs[0].toFixed(2)} - ${historicalPBs[historicalPBs.length-1].toFixed(2)}`);
      console.log(`   PB温度: ${temperature.toFixed(1)}° (对数分位数: ${(logPercentile * 100).toFixed(1)}%)`);
      return temperature;
    } catch (error) {
      console.warn('计算PB温度失败:', error.message);
      console.error(error.stack);
      return 50;
    }
  }
  
  /**
   * 计算历史温度序列
   */
  async calculateHistoricalTemperature(indexCode, startDate, endDate) {
    try {
      console.log(`\n📊 计算历史温度序列 [${startDate} - ${endDate}]`);
      
      // 从数据库获取有数据的调仓日期
      const dbService = require('./dbService');
      await dbService.init();
      
      const [dates] = await dbService.pool.execute(`
        SELECT DISTINCT trade_date 
        FROM index_weight 
        WHERE index_code = ? 
          AND trade_date >= ? 
          AND trade_date <= ?
        ORDER BY trade_date ASC
      `, [indexCode, startDate, endDate]);
      
      if (!dates || dates.length === 0) {
        console.warn('无历史调仓日期数据');
        return [];
      }
      
      console.log(`找到 ${dates.length} 个调仓日期`);
      
      const temperatures = [];
      
      // 为每个调仓日期计算温度
      for (const row of dates) {
        const date = row.trade_date;
        try {
          const temp = await this.calculateMarketTemperature(indexCode, date);
          temperatures.push({
            date: date,
            temperature: temp.temperature,
            level: temp.level,
            components: temp.components
          });
        } catch (error) {
          console.warn(`计算 ${date} 的温度失败:`, error.message);
        }
      }
      
      console.log(`✅ 计算完成，共 ${temperatures.length} 个温度点`);
      return temperatures;
    } catch (error) {
      console.error('计算历史温度失败:', error.message);
      console.error(error.stack);
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
      total: total,
      average: avgTemp,
      avgTemperature: avgTemp  // 添加这个字段供前端使用
    };
  }
  
  /**
   * 温度分级（三温带）
   */
  getTemperatureLevel(temperature) {
    if (temperature < 30) return 'COLD';      // 低估
    if (temperature < 70) return 'NORMAL';    // 中估
    return 'HOT';                             // 高估
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
      COLD: '温度不爱 - 市场处于低估状态，买入最佳时机',
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
        filterByQuality: true,
        description: '均衡配置 - 正常持有'
      },
      HOT: {
        maxWeight: 0.10,
        volatilityWindow: 12,
        minROE: 0.05,
        maxDebtRatio: 0.8,
        filterByQuality: true,
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
      params: this.getStrategyParams('NORMAL'),
      warning: [],
      date
    };
  }
  
  // ==================== 工具方法 ====================
  
  getDateBefore(date, days) {
    const d = new Date(
      parseInt(date.substring(0, 4)),
      parseInt(date.substring(4, 6)) - 1,
      parseInt(date.substring(6, 8))
    );
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }
}

module.exports = new MarketThermometerService();
