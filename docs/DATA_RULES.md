# KPL Link 数据规则

2026 年总使用 KPL 官方于 2026-09-21 公布的完整 12 队、84 人注册名单，canonical 输入为 `data/curated/official_rosters_2026_annual.json`。同队注册的七人（含替补、租借）产生 21 对关系，12 队合计 252 条本届证据；报名关系与实际出场关系分开保存，`provider` 为 `KPL official registered roster`，来源保留官方公告与原图。已知选手仍使用 canonical ID；小团、月月使用官方 `openid`，未公开统计身份的月秋使用明确隔离的注册身份，不因昵称相同归入别人。注册事实不生成比赛战绩或评分。

KPL Link 不维护独立人物事实库。构建脚本读取仓库现有的 `data/processed/players.json`（稳定选手 ID）、`player_attribution.json`（逐赛季实战归属）、`seasons.json`、`franchises.json` 和 `player_icon_cache.json`，从 KPL Guessing 快照复用别名、位置、活跃度与热度分层，并接入 `data/curated/wanplus_K*.json` 的早期逐局阵容及 `wanplus_identity_map.json` 的已审查身份映射。

2019 年及以后的关系，仅在两名选手的实战归属记录拥有完全相同的 `season_id` 和 `franchise_id` 时生成。仅仅先后效力于同一俱乐部不会产生边。每条边保存全部共同效力赛季证据，前端不在运行时从队名推断关系。`players.json` 的 `teams` 字段可能把后来的俱乐部归属带回早期赛季，因此不用于建边。

2016—2018 年补充关系要求两名选手在已记录的一局比赛中处于同一队。原始网页的两队选手交错排列，必须按 `wanplusTeamId` 分组，不能按前五人、后五人切分，也不能把该赛事所有出场选手合并后推断同队。每局必须有十个不同来源 ID、两个各五人的队伍；缺失阵容不生成关系。历史证据保留 `provider` 和 `sourceUrls`，不把非官方第三方记录标为官方数据。历史赛事使用 Link 内部的补充赛事标签，不修改上游模拟战场赛季。

`guessing/config/quiz.json` 的 `playerIdAliases` 会在建图前合并同一人的历史临时 ID；同名但 ID 不同的选手保持为不同节点。

身份无法映射至稳定 ID 的归属记录不会被猜测归属。构建结果的 `sourceAudit.unmappedRecords` 会记录被排除的数量；当前为 54 条，需要在未来上游数据清洗时复核。

早期身份仅采用已审查的来源 ID 映射，绝不因昵称相同自动合并。例如 2016 年仙阁“小羽”不能归到较晚出道的同名选手。`sourceAudit.historical` 保存历史比赛量、缺阵容数量、已审查身份数与未映射来源身份清单；`complete: false` 表示历史证据仍不完整，缺边不能据此解释为“从未做过队友”。

显式维护命令示例：`python <kpl2k>/tools/build_link_graph.py --snapshot-source <冻结数据目录> --output <link>/public/data --source-commit <冻结消费仓库完整SHA>`。源目录必须是包含完整 evidence 的原快照，不能把已拆分的 runtime 图重复当原始全图。全量重建另用 `--source <canonical根目录> --quiz-data <quiz_players.json> --quiz-config <quiz.json> --quiz-source-commit <竞猜输入完整SHA> --output <link>/public/data --source-commit <canonical完整SHA>`，不能使用隐式相邻目录。当前这一轮仅派生 d8cf8c847cb9b91bdaeaa814da6c28816557027b 冻结 Link 快照，未全量重建或更新任何人物/队友事实。

dataVersion 使用 `source:<完整SHA>`，旧日期只保留为 sourceAudit.legacyDataVersion，不代表本轮新增事实。manifest inputs 为来源仓库相对路径、来源 commit 与文件 SHA256，不包含用户机器目录；outputs 为本仓相对路径。schemaVersion、sourceCommit、inputs、outputs、generatedAt、coverage、exclusionRules、generator 是共用字段。输入来源是冻结消费快照，原始采集链缺口不能因补 manifest 而视为已解决。

运行快照为 players.json、link_graph.json（adjacency/stats/sourceAudit/latestYear）和 link_evidence.json。三个文件保留相同 dataVersion，manifest.json 记录真实 sourceCommit、输入hash、最终输出hash/bytes、生成器脚本hash和覆盖范围；最终头像路径不变后才计算hash。浏览器启动仅载 manifest+players+runtime，校验SHA与版本后才开放入口；详细证据只在查看共同效力依据或答案时加载，singleflight共享成功/在途结果，失败清除请求允许重试，绝不丢当前路径。BFS与出题只读轻量图和构建期 latestYear，不在出题时遍历 evidence。

latestYear 为每个ID证据中最大赛季年份，无可识别年份为 null；totalGames 是冻结源出场数，不能从图度数推导。当前748个稳定ID、4762边、9369条证据保持；18个无头像选手保留缺失，54条未映射归属仍排除，不自动补图或猜身份。历史 complete=false 继续保留。生成器检查ID/边对称/证据映射，测试独立对照冻结事实、latestYear与最终asset hash；真实浏览器验证按需加载失败重试和键盘焦点，不能用静态检查冒充浏览器或线上验收。
