# KPL Link

KPL 职业选手历史队友链小游戏，独立静态站。生产部署路径为 `/link/`，构建后的入口为 `dist/index.html`。

```sh
npm ci
npm test
npm run build
```

`public/data/` 是从 KPL 2K canonical 数据生成的版本化快照；`public/assets/player-icons/` 是本游戏使用的本地头像快照。运行时资源均位于 `/link/` 内，不依赖其他游戏目录。数据来源和建图规则见 [DATA_RULES](docs/DATA_RULES.md)。

正式 build 仅消费已生成快照；本轮从冻结消费版本派生，未全量重建上游事实。启动加载 manifest、players、轻量 adjacency/latestYear 图，查看答案依据才加载 evidence，失败可重试且保留当前路径。三快照使用实际来源完整 SHA 标识同一数据版本。

`npm test` 验证身份、真实图关系、最短路径、最终资源hash和异步故障；`npm run typecheck` 单独检查类型；`npm run build` 已包含一次 typecheck，无需在同一流程重复执行。浏览器性能/键盘/故障回归单独执行，需要可用 Playwright 和浏览器：

```sh
node scripts/verify-optimization.mjs --baseline <previous-Link-dist>
```

可用 `KPL_PLAYWRIGHT_PATH` 指定已有依赖、`KPL_BROWSER_CHANNEL=msedge` 指定 Edge；不设 channel 时使用 Playwright Chromium。报告写入忽略的 reports/。本轮实测和未完成边界见 [2026-10-20 整理报告](docs/OPTIMIZATION_20261020.md)。
