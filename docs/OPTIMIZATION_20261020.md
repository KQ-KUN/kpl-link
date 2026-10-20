# Link 本地优化与回归记录

起始版本 d8cf8c847cb9b91bdaeaa814da6c28816557027b；未推送、部署或修改生产注册表。运行图、详细证据和构建索引从该冻结快照派生，748 个选手、4,762 条边、9,369 条证据事实均保留，730 个本地头像字节不变。变更只有快照分包、来源版本标识、latestYear 索引和消费逻辑。54 条无法映射的归属、18 人缺头像、历史 complete=false 继续明确未知。

依赖方向为 main → snapshot/纯 game/graph → types。snapshot 管理 SHA/版本一致性及 singleflight；game 只消费 adjacency/latestYear，详细证据不参与出题/判题。输入修改才创建搜索结果；方向键只变更 aria/highlight/scroll，增删/Escape 恢复焦点。证据失败保留答案与路径，重试不重载核心图。

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 图文件磁盘字节 | 1,747,087 | 381,726 |
| 独立详细证据磁盘字节 | 包含于旧图 | 1,393,073 |
| 最终资源 manifest 磁盘字节 | 无 | 113,682 |
| dist 文件数 / 磁盘字节 | 736 / 4,831,387 | 738 / 4,975,478 |
| 首屏资源请求数 | 8 | 9 |
| 首屏资源 transferSize 合计 | 2,009,632 | 760,950 |
| 首屏 DOM 元素 | 101 | 101 |
| 打开完整选手搜索后 DOM 元素 | 5,305 | 5,305 |
| 连续15次方向键 childList mutation | 15 | 0 |
| 390px light 首屏观测完成时间 ms | 679.8 | 638.2 |

环境：Windows、Edge 155.0.4283.45、headless、同机 localhost 静态 HTTP、无压缩/限速，每配置一次；390/1440px × light/dark 共8次，390px启用 reduced-motion。时间为 ready 后等待 networkidle 时的 performance.now，包含约500ms空闲等待，不能当真实用户首屏时间或统计性加速结论。transferSize 是浏览器 Resource Timing 报告的资源传输量（不含导航/TCP/TLS），与磁盘字节和 encodedBodySize 分开；总发布体积略增，首屏避免下载完整证据。搜索保留全量可检索人物，不宣称减少其初次列表 DOM。

实际执行：npm test 22/22、typecheck 与 Vite build；Python test_link_snapshot 2/2；Edge8配置及核心JSON伪装HTML/连续重试、证据503重试、原路径保持、增删/Escape焦点和active选项滚动均通过。真实统计端点全部阻断，页面无未捕获异常。390px dark 与 Merge390px截图已人工查看；此处未执行移动真机、生产CDN、物理键盘设备验收。

可重跑命令见 README。详细本次原始证据位于 reports/optimization-browser.json、reports/after-390-dark.png 等（输出目录被忽略，不当源码依赖）；全套工作区交付保留这些文件。生成命令与来源边界见 DATA_RULES，build 不自动同步。
