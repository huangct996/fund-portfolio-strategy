# Tushare公告接口测试报告

**测试时间**: 2026/1/6 12:26:30

**测试股票**: 601668.SH 中国建筑

---

## 测试1: 查询最近一天的全部公告

**状态**: ✅ 成功

**耗时**: 237ms

**获取公告数**: 1494条

**示例数据**:

```json
[
  {
    "ann_date": "20260105",
    "ts_code": "000534.SZ",
    "name": "万泽股份",
    "title": "万泽股份第十二届董事会第一次会议决议公告",
    "url": "http://www.cninfo.com.cn/new/disclosure/detail?stockCode=000534&announcementId=1224914585&orgId=gssz0000534&announcementTime=2026-01-05"
  },
  {
    "ann_date": "20260105",
    "ts_code": "300363.SZ",
    "name": "博腾股份",
    "title": "2026年1月5日投资者关系活动记录表",
    "url": "http://www.cninfo.com.cn/new/disclosure/detail?stockCode=300363&announcementId=1224920983&orgId=9900022740&announcementTime=2026-01-05"
  }
]
```

**请求参数**:

```json
{
  "ann_date": "20260105"
}
```

---

## 测试2: 查询中国建筑2024年公告

**状态**: ✅ 成功

**耗时**: 125ms

**获取公告数**: 276条

**示例数据**:

```json
[
  {
    "ann_date": "20241231",
    "ts_code": "601668.SH",
    "name": "中国建筑",
    "title": "中国建筑重大项目公告",
    "url": "http://dataclouds.cninfo.com.cn/shgonggao/2024/2024-12-31/34e3cd84c69911ef88bbfa163e957f7a.pdf"
  },
  {
    "ann_date": "20241231",
    "ts_code": "601668.SH",
    "name": "中国建筑",
    "title": "中国建筑重大项目公告",
    "url": "http://www.cninfo.com.cn/new/disclosure/detail?stockCode=601668&announcementId=1222182490&orgId=9900005970&announcementTime=2024-12-31"
  }
]
```

**请求参数**:

```json
{
  "ts_code": "601668.SH",
  "start_date": "20240101",
  "end_date": "20241231"
}
```

---

## 测试3: 查询中国建筑近3年公告

**状态**: ✅ 成功

**耗时**: 179ms

**获取公告数**: 882条

**示例数据**:

```json
[
  {
    "ann_date": "20241231",
    "ts_code": "601668.SH",
    "name": "中国建筑",
    "title": "中国建筑重大项目公告",
    "url": "http://www.cninfo.com.cn/new/disclosure/detail?stockCode=601668&announcementId=1222182490&orgId=9900005970&announcementTime=2024-12-31"
  },
  {
    "ann_date": "20241231",
    "ts_code": "601668.SH",
    "name": "中国建筑",
    "title": "中国建筑重大项目公告",
    "url": "http://dataclouds.cninfo.com.cn/shgonggao/2024/2024-12-31/34e3cd84c69911ef88bbfa163e957f7a.pdf"
  }
]
```

**请求参数**:

```json
{
  "ts_code": "601668.SH",
  "start_date": "20220101",
  "end_date": "20241231"
}
```

---

