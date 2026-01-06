const mysql = require('mysql2/promise');
require('dotenv').config();

class DatabaseService {
  constructor() {
    this.pool = null;
  }

  async init() {
    if (this.pool) return;

    try {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      await this.createTables();
      console.log('✅ 数据库连接成功');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      throw error;
    }
  }

  async createTables() {
    const connection = await this.pool.getConnection();
    
    try {
      // 1. 基金持仓表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS fund_portfolio (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '基金代码',
          ann_date VARCHAR(8) NOT NULL COMMENT '公告日期',
          end_date VARCHAR(8) NOT NULL COMMENT '报告期',
          symbol VARCHAR(20) NOT NULL COMMENT '股票代码',
          mkv DECIMAL(20, 2) COMMENT '持仓市值',
          amount BIGINT COMMENT '持仓数量',
          stk_mkv_ratio DECIMAL(10, 4) COMMENT '占净值比例',
          stk_float_ratio DECIMAL(10, 4) COMMENT '占流通股比例',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_portfolio (ts_code, end_date, symbol),
          KEY idx_ts_code (ts_code),
          KEY idx_end_date (end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='基金持仓表'
      `);

      // 2. 股票日线行情表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS stock_daily (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '股票代码',
          trade_date VARCHAR(8) NOT NULL COMMENT '交易日期',
          open_price DECIMAL(10, 3) COMMENT '开盘价',
          high_price DECIMAL(10, 3) COMMENT '最高价',
          low_price DECIMAL(10, 3) COMMENT '最低价',
          close_price DECIMAL(10, 3) COMMENT '收盘价',
          volume BIGINT COMMENT '成交量',
          amount DECIMAL(20, 2) COMMENT '成交额',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_daily (ts_code, trade_date),
          KEY idx_ts_code (ts_code),
          KEY idx_trade_date (trade_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='股票日线行情表'
      `);

      // 3. 复权因子表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS stock_adj_factor (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '股票代码',
          trade_date VARCHAR(8) NOT NULL COMMENT '交易日期',
          adj_factor DECIMAL(12, 6) COMMENT '复权因子',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_adj_factor (ts_code, trade_date),
          KEY idx_ts_code (ts_code),
          KEY idx_trade_date (trade_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='复权因子表'
      `);

      // 4. 指数日线行情表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS index_daily (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '指数代码',
          trade_date VARCHAR(8) NOT NULL COMMENT '交易日期',
          open_price DECIMAL(10, 3) COMMENT '开盘价',
          high_price DECIMAL(10, 3) COMMENT '最高价',
          low_price DECIMAL(10, 3) COMMENT '最低价',
          close_price DECIMAL(10, 3) COMMENT '收盘价',
          volume BIGINT COMMENT '成交量',
          amount DECIMAL(20, 2) COMMENT '成交额',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_index_daily (ts_code, trade_date),
          KEY idx_ts_code (ts_code),
          KEY idx_trade_date (trade_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指数日线行情表'
      `);

      // 5. 股票基本信息表（市值、股息率、PE、PB、ROE、负债率等）
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS stock_basic_info (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '股票代码',
          name VARCHAR(50) COMMENT '股票名称',
          trade_date VARCHAR(8) NOT NULL COMMENT '交易日期',
          total_mv DECIMAL(20, 2) COMMENT '总市值（万元）',
          dv_ratio DECIMAL(10, 4) COMMENT '股息率（%）',
          pe_ttm DECIMAL(10, 4) COMMENT '市盈率TTM',
          pb DECIMAL(10, 4) COMMENT '市净率',
          roe DECIMAL(10, 4) COMMENT 'ROE净资产收益率（%）',
          debt_ratio DECIMAL(10, 4) COMMENT '资产负债率（%）',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_basic_info (ts_code, trade_date),
          KEY idx_ts_code (ts_code),
          KEY idx_trade_date (trade_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='股票基本信息表'
      `);

      // 6. 指数每日估值指标表（PE、PB、市值等）
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS index_dailybasic (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '指数代码',
          trade_date VARCHAR(8) NOT NULL COMMENT '交易日期',
          total_mv DECIMAL(20, 2) COMMENT '总市值（万元）',
          float_mv DECIMAL(20, 2) COMMENT '流通市值（万元）',
          total_share DECIMAL(20, 2) COMMENT '总股本（万股）',
          float_share DECIMAL(20, 2) COMMENT '流通股本（万股）',
          free_share DECIMAL(20, 2) COMMENT '自由流通股本（万股）',
          turnover_rate DECIMAL(10, 4) COMMENT '换手率（%）',
          turnover_rate_f DECIMAL(10, 4) COMMENT '换手率（自由流通）（%）',
          pe DECIMAL(10, 4) COMMENT '市盈率',
          pe_ttm DECIMAL(10, 4) COMMENT '市盈率TTM',
          pb DECIMAL(10, 4) COMMENT '市净率',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_index_dailybasic (ts_code, trade_date),
          KEY idx_ts_code (ts_code),
          KEY idx_trade_date (trade_date),
          KEY idx_pe (pe),
          KEY idx_pb (pb)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指数每日估值指标表'
      `);
      
      // 确保name、roe、debt_ratio字段存在（兼容旧版本表结构）
      try {
        // 检查并添加name字段
        const [nameColumns] = await connection.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'stock_basic_info' 
          AND COLUMN_NAME = 'name'
        `);
        
        if (nameColumns.length === 0) {
          await connection.execute(`
            ALTER TABLE stock_basic_info 
            ADD COLUMN name VARCHAR(50) COMMENT '股票名称' AFTER ts_code
          `);
          console.log('✅ 已添加name字段到stock_basic_info表');
        }
        
        // 检查并添加roe字段
        const [roeColumns] = await connection.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'stock_basic_info' 
          AND COLUMN_NAME = 'roe'
        `);
        
        if (roeColumns.length === 0) {
          await connection.execute(`
            ALTER TABLE stock_basic_info 
            ADD COLUMN roe DECIMAL(10, 4) COMMENT 'ROE净资产收益率（%）' AFTER pb
          `);
          console.log('✅ 已添加roe字段到stock_basic_info表');
        }
        
        // 检查并添加debt_ratio字段
        const [debtColumns] = await connection.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'stock_basic_info' 
          AND COLUMN_NAME = 'debt_ratio'
        `);
        
        if (debtColumns.length === 0) {
          await connection.execute(`
            ALTER TABLE stock_basic_info 
            ADD COLUMN debt_ratio DECIMAL(10, 4) COMMENT '资产负债率（%）' AFTER roe
          `);
          console.log('✅ 已添加debt_ratio字段到stock_basic_info表');
        }
      } catch (error) {
        console.warn('检查或添加字段时出现警告:', error.message);
      }

      // 5. 基金净值表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS fund_nav (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '基金代码',
          nav_date VARCHAR(8) NOT NULL COMMENT '净值日期',
          unit_nav DECIMAL(10, 4) COMMENT '单位净值',
          accum_nav DECIMAL(10, 4) COMMENT '累计净值',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_nav (ts_code, nav_date),
          KEY idx_ts_code (ts_code),
          KEY idx_nav_date (nav_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='基金净值表'
      `);

      // 6. 指数成分股权重表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS index_weight (
          id INT AUTO_INCREMENT PRIMARY KEY,
          index_code VARCHAR(20) NOT NULL COMMENT '指数代码',
          con_code VARCHAR(20) NOT NULL COMMENT '成分股代码',
          trade_date VARCHAR(8) NOT NULL COMMENT '交易日期（调仓日期）',
          weight DECIMAL(10, 6) COMMENT '权重（%）',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_index_weight (index_code, trade_date, con_code),
          KEY idx_index_code (index_code),
          KEY idx_trade_date (trade_date),
          KEY idx_con_code (con_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指数成分股权重表'
      `);

      // 7. 数据同步记录表（记录已完整同步的数据范围）
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS data_sync_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '股票代码',
          data_type VARCHAR(20) NOT NULL COMMENT '数据类型：daily/adj_factor',
          start_date VARCHAR(8) NOT NULL COMMENT '同步起始日期',
          end_date VARCHAR(8) NOT NULL COMMENT '同步结束日期',
          record_count INT NOT NULL COMMENT '实际记录数',
          sync_status VARCHAR(20) DEFAULT 'completed' COMMENT '同步状态：completed/partial/failed',
          sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '同步时间',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_sync_log (ts_code, data_type, start_date, end_date),
          KEY idx_ts_code (ts_code),
          KEY idx_data_type (data_type),
          KEY idx_sync_status (sync_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据同步记录表'
      `);

      // 8. 数据缺失标记表（标记确认不存在的数据，避免重复查询）
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS data_missing_mark (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '股票/基金/指数代码',
          data_type VARCHAR(50) NOT NULL COMMENT '数据类型：daily/adj_factor/fund_nav/index_daily等',
          trade_date VARCHAR(8) NOT NULL COMMENT '交易日期',
          mark_reason VARCHAR(100) COMMENT '标记原因',
          mark_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '标记时间',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_missing_mark (ts_code, data_type, trade_date),
          KEY idx_ts_code (ts_code),
          KEY idx_data_type (data_type),
          KEY idx_trade_date (trade_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据缺失标记表'
      `);

      console.log('✅ 数据库表创建/检查完成');
    } finally {
      connection.release();
    }
  }

  // ==================== 基金持仓相关 ====================
  
  async getFundPortfolio(tsCode) {
    const [rows] = await this.pool.execute(
      'SELECT * FROM fund_portfolio WHERE ts_code = ? ORDER BY end_date DESC',
      [tsCode]
    );
    return rows;
  }

  async saveFundPortfolio(data) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of data) {
        await connection.execute(`
          INSERT INTO fund_portfolio 
          (ts_code, ann_date, end_date, symbol, mkv, amount, stk_mkv_ratio, stk_float_ratio)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            mkv = VALUES(mkv),
            amount = VALUES(amount),
            stk_mkv_ratio = VALUES(stk_mkv_ratio),
            stk_float_ratio = VALUES(stk_float_ratio),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.ts_code,
          item.ann_date,
          item.end_date,
          item.symbol,
          item.mkv,
          item.amount,
          item.stk_mkv_ratio,
          item.stk_float_ratio
        ]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 股票价格相关 ====================
  
  async getStockDaily(tsCode, startDate, endDate) {
    const [rows] = await this.pool.execute(`
      SELECT * FROM stock_daily 
      WHERE ts_code = ? AND trade_date >= ? AND trade_date <= ?
      ORDER BY trade_date ASC
    `, [tsCode, startDate, endDate]);
    return rows;
  }

  /**
   * 批量获取多只股票的日线数据
   * @param {Array} tsCodes - 股票代码数组
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Object} 股票代码到数据数组的映射
   */
  async getStockDailyBatch(tsCodes, startDate, endDate) {
    if (!tsCodes || tsCodes.length === 0) return {};
    
    const placeholders = tsCodes.map(() => '?').join(',');
    const [rows] = await this.pool.execute(`
      SELECT * FROM stock_daily 
      WHERE ts_code IN (${placeholders}) AND trade_date >= ? AND trade_date <= ?
      ORDER BY ts_code, trade_date ASC
    `, [...tsCodes, startDate, endDate]);
    
    // 按股票代码分组
    const result = {};
    for (const row of rows) {
      if (!result[row.ts_code]) {
        result[row.ts_code] = [];
      }
      result[row.ts_code].push(row);
    }
    
    return result;
  }

  async saveStockDaily(data) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of data) {
        await connection.execute(`
          INSERT INTO stock_daily 
          (ts_code, trade_date, open_price, high_price, low_price, close_price, volume, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            open_price = VALUES(open_price),
            high_price = VALUES(high_price),
            low_price = VALUES(low_price),
            close_price = VALUES(close_price),
            volume = VALUES(volume),
            amount = VALUES(amount),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.ts_code,
          item.trade_date,
          item.open,
          item.high,
          item.low,
          item.close,
          item.vol,
          item.amount
        ]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 复权因子相关 ====================
  
  async getAdjFactor(tsCode, startDate, endDate) {
    const [rows] = await this.pool.execute(`
      SELECT * FROM stock_adj_factor 
      WHERE ts_code = ? AND trade_date >= ? AND trade_date <= ?
      ORDER BY trade_date ASC
    `, [tsCode, startDate, endDate]);
    return rows;
  }

  /**
   * 批量获取多只股票的复权因子
   * @param {Array} tsCodes - 股票代码数组
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Object} 股票代码到复权因子数组的映射
   */
  async getAdjFactorBatch(tsCodes, startDate, endDate) {
    if (!tsCodes || tsCodes.length === 0) return {};
    
    const placeholders = tsCodes.map(() => '?').join(',');
    const [rows] = await this.pool.execute(`
      SELECT * FROM stock_adj_factor 
      WHERE ts_code IN (${placeholders}) AND trade_date >= ? AND trade_date <= ?
      ORDER BY ts_code, trade_date ASC
    `, [...tsCodes, startDate, endDate]);
    
    // 按股票代码分组
    const result = {};
    for (const row of rows) {
      if (!result[row.ts_code]) {
        result[row.ts_code] = [];
      }
      result[row.ts_code].push(row);
    }
    
    return result;
  }

  async saveAdjFactor(data) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of data) {
        await connection.execute(`
          INSERT INTO stock_adj_factor 
          (ts_code, trade_date, adj_factor)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            adj_factor = VALUES(adj_factor),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.ts_code,
          item.trade_date,
          item.adj_factor
        ]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 股票基本信息相关 ====================
  
  async getStockBasicInfo(tsCode, tradeDate) {
    const [rows] = await this.pool.execute(`
      SELECT * FROM stock_basic_info 
      WHERE ts_code = ? AND trade_date = ?
    `, [tsCode, tradeDate]);
    return rows[0];
  }

  async saveStockBasicInfo(data) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of data) {
        await connection.execute(`
          INSERT INTO stock_basic_info 
          (ts_code, name, trade_date, total_mv, dv_ratio, pe_ttm, pb)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            total_mv = VALUES(total_mv),
            dv_ratio = VALUES(dv_ratio),
            pe_ttm = VALUES(pe_ttm),
            pb = VALUES(pb),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.ts_code,
          item.name || null,
          item.trade_date,
          item.total_mv,
          item.dv_ratio,
          item.pe_ttm,
          item.pb
        ]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateStockFinancialInfo(data) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of data) {
        await connection.execute(`
          INSERT INTO stock_basic_info 
          (ts_code, trade_date, roe, debt_ratio)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            roe = VALUES(roe),
            debt_ratio = VALUES(debt_ratio),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.ts_code,
          item.trade_date,
          item.roe,
          item.debt_ratio
        ]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 指数日线相关 ====================
  
  async saveIndexDaily(data) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of data) {
        await connection.execute(`
          INSERT INTO index_daily 
          (ts_code, trade_date, close_price, volume, amount)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            close_price = VALUES(close_price),
            volume = VALUES(volume),
            amount = VALUES(amount),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.ts_code,
          item.trade_date,
          item.close,
          item.vol || 0,
          item.amount || 0
        ]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 基金净值相关 ====================
  
  async getFundNav(tsCode, startDate, endDate = null) {
    let query = `
      SELECT * FROM fund_nav 
      WHERE ts_code = ? AND nav_date >= ?
    `;
    const params = [tsCode, startDate];
    
    if (endDate) {
      query += ` AND nav_date <= ?`;
      params.push(endDate);
    }
    
    query += ` ORDER BY nav_date ASC`;
    
    const [rows] = await this.pool.execute(query, params);
    return rows;
  }

  async saveFundNav(data) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of data) {
        await connection.execute(`
          INSERT INTO fund_nav 
          (ts_code, nav_date, unit_nav, accum_nav)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            unit_nav = VALUES(unit_nav),
            accum_nav = VALUES(accum_nav),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.ts_code,
          item.nav_date,
          item.unit_nav,
          item.accum_nav
        ]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 指数成分股权重相关 ====================
  
  async getIndexWeight(indexCode, tradeDate = null) {
    let query = 'SELECT * FROM index_weight WHERE index_code = ?';
    const params = [indexCode];
    
    if (tradeDate) {
      query += ' AND trade_date = ?';
      params.push(tradeDate);
    }
    
    query += ' ORDER BY trade_date DESC, weight DESC';
    
    const [rows] = await this.pool.execute(query, params);
    return rows;
  }

  async getIndexWeightDates(indexCode) {
    const allDates = await this.getAllIndexWeightDates(indexCode);
    if (allDates.length === 0) return [];

    const rebalanceDates = [];
    let prevStocks = null;

    for (let i = 0; i < allDates.length; i++) {
      const date = allDates[i];
      const [rows] = await this.pool.execute(`
        SELECT con_code FROM index_weight 
        WHERE index_code = ? AND trade_date = ?
        ORDER BY con_code
      `, [indexCode, date]);
      
      const currentStocks = new Set(rows.map(r => r.con_code));

      if (i === 0) {
        rebalanceDates.push(date);
      } else if (prevStocks) {
        const added = [...currentStocks].filter(code => !prevStocks.has(code));
        const removed = [...prevStocks].filter(code => !currentStocks.has(code));
        
        if (added.length > 0 || removed.length > 0) {
          rebalanceDates.push(date);
        }
      }

      prevStocks = currentStocks;
    }

    return rebalanceDates;
  }

  async getAllIndexWeightDates(indexCode) {
    const [rows] = await this.pool.execute(`
      SELECT DISTINCT trade_date 
      FROM index_weight 
      WHERE index_code = ?
      ORDER BY trade_date ASC
    `, [indexCode]);
    return rows.map(r => r.trade_date);
  }

  async getRebalanceChanges(indexCode) {
    const allDates = await this.getAllIndexWeightDates(indexCode);
    if (allDates.length === 0) return [];

    const changes = [];
    let prevStocks = null;
    let prevDate = null;

    for (let i = 0; i < allDates.length; i++) {
      const date = allDates[i];
      const [rows] = await this.pool.execute(`
        SELECT con_code FROM index_weight 
        WHERE index_code = ? AND trade_date = ?
        ORDER BY con_code
      `, [indexCode, date]);
      
      const currentStocks = new Set(rows.map(r => r.con_code));

      if (i === 0) {
        changes.push({
          date,
          prevDate: null,
          totalStocks: currentStocks.size,
          prevTotalStocks: 0,
          added: [...currentStocks].sort(),
          removed: [],
          addedCount: currentStocks.size,
          removedCount: 0,
          isInitial: true
        });
      } else if (prevStocks) {
        const added = [...currentStocks].filter(code => !prevStocks.has(code)).sort();
        const removed = [...prevStocks].filter(code => !currentStocks.has(code)).sort();
        
        if (added.length > 0 || removed.length > 0) {
          changes.push({
            date,
            prevDate,
            totalStocks: currentStocks.size,
            prevTotalStocks: prevStocks.size,
            added,
            removed,
            addedCount: added.length,
            removedCount: removed.length,
            isInitial: false
          });
        }
      }

      prevStocks = currentStocks;
      prevDate = date;
    }

    return changes;
  }

  async saveIndexWeight(data) {
    if (!data || data.length === 0) return;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of data) {
        await connection.execute(`
          INSERT INTO index_weight 
          (index_code, con_code, trade_date, weight)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            weight = VALUES(weight),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.index_code,
          item.con_code,
          item.trade_date,
          item.weight
        ]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 数据同步记录相关 ====================
  
  /**
   * 检查数据是否已完整同步
   * 返回：{ isSynced: boolean, missingRanges: [{start, end}] }
   */
  async checkSyncStatus(tsCode, dataType, startDate, endDate) {
    // 1. 查找是否有单条记录完全覆盖请求范围
    const [fullCoverRows] = await this.pool.execute(`
      SELECT * FROM data_sync_log 
      WHERE ts_code = ? 
        AND data_type = ? 
        AND start_date <= ? 
        AND end_date >= ?
        AND sync_status = 'completed'
      ORDER BY sync_time DESC
      LIMIT 1
    `, [tsCode, dataType, startDate, endDate]);
    
    if (fullCoverRows.length > 0) {
      return { isSynced: true, missingRanges: [], fullCoverRecord: fullCoverRows[0] };
    }
    
    // 2. 查找所有与请求范围有交集的同步记录
    const [overlapRows] = await this.pool.execute(`
      SELECT * FROM data_sync_log 
      WHERE ts_code = ? 
        AND data_type = ? 
        AND sync_status = 'completed'
        AND (
          (start_date <= ? AND end_date >= ?) OR  -- 覆盖起始日期
          (start_date <= ? AND end_date >= ?) OR  -- 覆盖结束日期
          (start_date >= ? AND end_date <= ?)     -- 完全包含在内
        )
      ORDER BY start_date ASC
    `, [tsCode, dataType, startDate, startDate, endDate, endDate, startDate, endDate]);
    
    if (overlapRows.length === 0) {
      // 没有任何同步记录，整个范围都需要同步
      return { isSynced: false, missingRanges: [{ start: startDate, end: endDate }] };
    }
    
    // 3. 计算缺失的日期范围
    const missingRanges = this.calculateMissingRanges(startDate, endDate, overlapRows);
    
    return { 
      isSynced: missingRanges.length === 0, 
      missingRanges,
      existingRecords: overlapRows
    };
  }
  
  /**
   * 计算缺失的日期范围
   */
  calculateMissingRanges(requestStart, requestEnd, syncedRecords) {
    if (syncedRecords.length === 0) {
      return [{ start: requestStart, end: requestEnd }];
    }
    
    // 按起始日期排序
    const sorted = syncedRecords.sort((a, b) => a.start_date.localeCompare(b.start_date));
    const missing = [];
    
    let currentPos = requestStart;
    
    for (const record of sorted) {
      // 如果当前位置在记录开始之前，说明有缺失
      if (currentPos < record.start_date) {
        missing.push({ start: currentPos, end: record.start_date });
      }
      
      // 更新当前位置到记录结束位置（如果更大）
      if (record.end_date > currentPos) {
        currentPos = record.end_date;
      }
    }
    
    // 检查最后是否还有缺失
    if (currentPos < requestEnd) {
      missing.push({ start: currentPos, end: requestEnd });
    }
    
    return missing;
  }
  
  /**
   * 记录数据同步状态
   */
  async recordSyncStatus(tsCode, dataType, startDate, endDate, recordCount, syncStatus = 'completed') {
    await this.pool.execute(`
      INSERT INTO data_sync_log 
      (ts_code, data_type, start_date, end_date, record_count, sync_status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        record_count = VALUES(record_count),
        sync_status = VALUES(sync_status),
        sync_time = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [tsCode, dataType, startDate, endDate, recordCount, syncStatus]);
  }

  // ==================== 数据缺失标记相关 ====================
  
  /**
   * 检查数据是否已标记为缺失
   * @param {string} tsCode - 代码
   * @param {string} dataType - 数据类型
   * @param {string} tradeDate - 交易日期
   * @returns {boolean} 是否已标记为缺失
   */
  async isMarkedAsMissing(tsCode, dataType, tradeDate) {
    const [rows] = await this.pool.execute(`
      SELECT * FROM data_missing_mark 
      WHERE ts_code = ? AND data_type = ? AND trade_date = ?
    `, [tsCode, dataType, tradeDate]);
    return rows.length > 0;
  }

  /**
   * 标记数据为缺失
   * @param {string} tsCode - 代码
   * @param {string} dataType - 数据类型
   * @param {string} tradeDate - 交易日期
   * @param {string} reason - 标记原因
   */
  async markDataAsMissing(tsCode, dataType, tradeDate, reason = '数据不存在') {
    await this.pool.execute(`
      INSERT IGNORE INTO data_missing_mark 
      (ts_code, data_type, trade_date, mark_reason)
      VALUES (?, ?, ?, ?)
    `, [tsCode, dataType, tradeDate, reason]);
  }

  /**
   * 批量标记数据为缺失
   * @param {Array} marks - 标记数组，每项包含 {tsCode, dataType, tradeDate, reason}
   */
  async markDataAsMissingBatch(marks) {
    if (!marks || marks.length === 0) return;
    
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      
      for (const mark of marks) {
        await connection.execute(`
          INSERT IGNORE INTO data_missing_mark 
          (ts_code, data_type, trade_date, mark_reason)
          VALUES (?, ?, ?, ?)
        `, [mark.tsCode, mark.dataType, mark.tradeDate, mark.reason || '数据不存在']);
      }
      
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 指数每日估值指标相关 ====================
  
  /**
   * 保存指数每日估值指标数据
   * @param {Array} data - 指数每日估值指标数据数组
   */
  async saveIndexDailybasic(data) {
    if (!data || data.length === 0) return;
    
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      
      for (const item of data) {
        await connection.execute(`
          INSERT INTO index_dailybasic 
          (ts_code, trade_date, total_mv, float_mv, total_share, float_share, 
           free_share, turnover_rate, turnover_rate_f, pe, pe_ttm, pb)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            total_mv = VALUES(total_mv),
            float_mv = VALUES(float_mv),
            total_share = VALUES(total_share),
            float_share = VALUES(float_share),
            free_share = VALUES(free_share),
            turnover_rate = VALUES(turnover_rate),
            turnover_rate_f = VALUES(turnover_rate_f),
            pe = VALUES(pe),
            pe_ttm = VALUES(pe_ttm),
            pb = VALUES(pb),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.ts_code,
          item.trade_date,
          item.total_mv,
          item.float_mv,
          item.total_share,
          item.float_share,
          item.free_share,
          item.turnover_rate,
          item.turnover_rate_f,
          item.pe,
          item.pe_ttm,
          item.pb
        ]);
      }
      
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 查询指数每日估值指标数据
   * @param {string} tsCode - 指数代码
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Array} 指数每日估值指标数据
   */
  async getIndexDailybasic(tsCode, startDate, endDate = null) {
    let sql = `
      SELECT * FROM index_dailybasic 
      WHERE ts_code = ? AND trade_date >= ?
    `;
    const params = [tsCode, startDate];
    
    if (endDate) {
      sql += ' AND trade_date <= ?';
      params.push(endDate);
    }
    
    sql += ' ORDER BY trade_date ASC';
    
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  /**
   * 获取指数最新的估值指标
   * @param {string} tsCode - 指数代码
   * @returns {Object} 最新估值指标
   */
  async getLatestIndexDailybasic(tsCode) {
    const [rows] = await this.pool.execute(`
      SELECT * FROM index_dailybasic 
      WHERE ts_code = ? 
      ORDER BY trade_date DESC 
      LIMIT 1
    `, [tsCode]);
    return rows[0] || null;
  }

  /**
   * 检查指数数据是否需要更新
   * @param {string} tsCode - 指数代码
   * @returns {Object} {needUpdate: boolean, lastDate: string}
   */
  async checkIndexDailybasicUpdate(tsCode) {
    const latest = await this.getLatestIndexDailybasic(tsCode);
    
    if (!latest) {
      return { needUpdate: true, lastDate: null };
    }
    
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const needUpdate = latest.trade_date < today;
    
    return { needUpdate, lastDate: latest.trade_date };
  }

  /**
   * 检查日期是否超过一个月
   * @param {string} dateStr - 日期字符串（YYYYMMDD）
   * @returns {boolean} 是否超过一个月
   */
  isOlderThanOneMonth(dateStr) {
    const date = new Date(
      dateStr.substring(0, 4),
      parseInt(dateStr.substring(4, 6)) - 1,
      dateStr.substring(6, 8)
    );
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return date < oneMonthAgo;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = new DatabaseService();
