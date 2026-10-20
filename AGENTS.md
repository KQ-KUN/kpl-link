# KPL Link 本地维护

- 先读 README.md、docs/DATA_RULES.md。UI 保持平台 UI_STANDARD v2；当前任务仅性能、可靠性与数据来源，不扩展视觉设计。
- 正式 build 只消费 public/data 已生成快照。显式维护生成器位于 kpl2k/tools/build_link_graph.py，使用 --source/--snapshot-source、--output、--source-commit，不能依赖相邻仓库的隐式目录。冻结派生不得被描述为上游原始数据全量重建。
- players、runtime graph、详细 evidence 必须 dataVersion 一致并匹配 manifest 最终 hash。出题/BFS/判题只读 adjacency 与预计算 latestYear；详细证据仅用户查看解释或答案时加载。失败可重试、共享请求、保留当前路径。
- 保持稳定 ID 和同名隔离。保留完整来源证据、未知 null、统计单位和来源链缺口，不因缺边宣称从未做过队友，不用昵称合并。
- 搜索仅 input 时过滤与创建列表；方向键更新 aria-activedescendant、选中状态和滚动，不能重建结果。增删后恢复有效焦点。
- npm test / npm run build 检查逻辑、真实冻结事实、hash和TS；浏览器脚本单列真实键盘、故障恢复、主题/视口/reduced-motion及请求测量。不得发送真实产品统计。
- 本批仅本地，禁止 push、部署、修改生产注册表或擅自同步事实。保留已有无关改动。
