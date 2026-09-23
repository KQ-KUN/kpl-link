# KPL Link

KPL 职业选手历史队友链小游戏，独立静态站。生产部署路径为 `/link/`，构建后的入口为 `dist/index.html`。

```sh
npm ci
npm test
npm run build
```

`public/data/` 是从 KPL 2K canonical 数据生成的版本化快照；`public/assets/player-icons/` 是本游戏使用的本地头像快照。运行时资源均位于 `/link/` 内，不依赖其他游戏目录。数据来源和建图规则见 [DATA_RULES](docs/DATA_RULES.md)。
