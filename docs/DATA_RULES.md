# KPL Link 数据规则

KPL Link 不维护独立人物事实库。构建脚本读取仓库现有的 `data/processed/players.json`（稳定选手 ID）、`player_attribution.json`（逐赛季实战归属）、`seasons.json`、`franchises.json` 和 `player_icon_cache.json`，并只从 KPL Guessing 快照复用别名、位置、活跃度与热度分层。

一条无向边仅在两名选手的实战归属记录拥有完全相同的 `season_id` 和 `franchise_id` 时生成。仅仅先后效力于同一俱乐部不会产生边。每条边保存全部共同效力赛季证据，前端不在运行时从队名推断关系。`players.json` 的 `teams` 字段可能把后来的俱乐部归属带回早期赛季，因此不用于建边。

`guessing/config/quiz.json` 的 `playerIdAliases` 会在建图前合并同一人的历史临时 ID；同名但 ID 不同的选手保持为不同节点。

身份无法映射至稳定 ID 的归属记录不会被猜测归属。构建结果的 `sourceAudit.unmappedRecords` 会记录被排除的数量；当前为 54 条，需要在未来上游数据清洗时复核。

运行 `.venv\Scripts\python.exe tools\build_link_graph.py` 重新生成 `link/public/data/players.json` 与 `link/public/data/link_graph.json`。随后运行 `.venv\Scripts\python.exe tools\validate_link_graph.py` 检查对称性、自环、证据、版本和统计值。
