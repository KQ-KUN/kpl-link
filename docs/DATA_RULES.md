# KPL Link 数据规则

KPL Link 不维护独立人物事实库。构建脚本读取仓库现有的 `data/processed/players.json`（稳定选手 ID）、`player_attribution.json`（逐赛季实战归属）、`seasons.json`、`franchises.json` 和 `player_icon_cache.json`，从 KPL Guessing 快照复用别名、位置、活跃度与热度分层，并接入 `data/curated/wanplus_K*.json` 的早期逐局阵容及 `wanplus_identity_map.json` 的已审查身份映射。

2019 年及以后的关系，仅在两名选手的实战归属记录拥有完全相同的 `season_id` 和 `franchise_id` 时生成。仅仅先后效力于同一俱乐部不会产生边。每条边保存全部共同效力赛季证据，前端不在运行时从队名推断关系。`players.json` 的 `teams` 字段可能把后来的俱乐部归属带回早期赛季，因此不用于建边。

2016—2018 年补充关系要求两名选手在已记录的一局比赛中处于同一队。原始网页的两队选手交错排列，必须按 `wanplusTeamId` 分组，不能按前五人、后五人切分，也不能把该赛事所有出场选手合并后推断同队。每局必须有十个不同来源 ID、两个各五人的队伍；缺失阵容不生成关系。历史证据保留 `provider` 和 `sourceUrls`，不把非官方第三方记录标为官方数据。历史赛事使用 Link 内部的补充赛事标签，不修改上游模拟战场赛季。

`guessing/config/quiz.json` 的 `playerIdAliases` 会在建图前合并同一人的历史临时 ID；同名但 ID 不同的选手保持为不同节点。

身份无法映射至稳定 ID 的归属记录不会被猜测归属。构建结果的 `sourceAudit.unmappedRecords` 会记录被排除的数量；当前为 54 条，需要在未来上游数据清洗时复核。

早期身份仅采用已审查的来源 ID 映射，绝不因昵称相同自动合并。例如 2016 年仙阁“小羽”不能归到较晚出道的同名选手。`sourceAudit.historical` 保存历史比赛量、缺阵容数量、已审查身份数与未映射来源身份清单；`complete: false` 表示历史证据仍不完整，缺边不能据此解释为“从未做过队友”。

运行 `.venv\Scripts\python.exe tools\build_link_graph.py` 重新生成 `link/public/data/players.json` 与 `link/public/data/link_graph.json`。头像生成到本游戏的 `./assets/player-icons/` 路径，按稳定 ID 优先选择，避免构建时顺序不确定。随后运行 `.venv\Scripts\python.exe tools\validate_link_graph.py` 检查对称性、自环、证据、版本、统计值，以及源数据到快照的完整一致性。`tools/test_link_graph.py` 另从原始逐局记录独立重建历史关系和来源集合，覆盖遗漏、错队、同名、别名与无阵容情况。
