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

      // 4. 股票基本信息表（市值、股息率、PE、PB等）
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS stock_basic_info (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ts_code VARCHAR(20) NOT NULL COMMENT '股票代码',
          trade_date VARCHAR(8) NOT NULL COMMENT '交易日期',
          total_mv DECIMAL(20, 2) COMMENT '总市值（万元）',
          dv_ratio DECIMAL(10, 4) COMMENT '股息率（%）',
          pe_ttm DECIMAL(10, 4) COMMENT '市盈率TTM',
          pb DECIMAL(10, 4) COMMENT '市净率',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_basic_info (ts_code, trade_date),
          KEY idx_ts_code (ts_code),
          KEY idx_trade_date (trade_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='股票基本信息表'
      `);

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
          (ts_code, trade_date, total_mv, dv_ratio, pe_ttm, pb)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            total_mv = VALUES(total_mv),
            dv_ratio = VALUES(dv_ratio),
            pe_ttm = VALUES(pe_ttm),
            pb = VALUES(pb),
            updated_at = CURRENT_TIMESTAMP
        `, [
          item.ts_code,
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

  // ==================== 基金净值相关 ====================
  
  async getFundNav(tsCode, startDate) {
    const [rows] = await this.pool.execute(`
      SELECT * FROM fund_nav 
      WHERE ts_code = ? AND nav_date >= ?
      ORDER BY nav_date ASC
    `, [tsCode, startDate]);
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

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = new DatabaseService();
