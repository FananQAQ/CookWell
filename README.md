# CookWell

家庭做饭用的微信小程序：从菜谱里挑菜、组菜单、定份数，再一键看做法图和备料清单。

菜谱数据来自开源项目 [HowToCook](https://github.com/Anduin2017/HowToCook)（正文）与 [king-jingxiang/HowToCook](https://github.com/king-jingxiang/HowToCook)（配图索引），本地打包进分包，**无后端**，菜单与历史存在手机本地存储。

## 能做什么

- **菜谱**：按分类浏览 / 搜索约 300+ 道菜，点进详情看做法长图
- **当前菜单**：选份数加入菜单，按「菜品种数」计数，可改份数或整道删除
- **备料汇总**
  - **菜品图**：横向导航 + 滑动浏览各菜做法图
  - **合并清单**：同物异名归并（如蒜片 / 蒜末 → 大蒜），并按份数换算用量；可标记已买
- **我的菜单**：提交后的历史菜单，可再打开备料与做法

## 项目结构

```
CookWell/
├── app.js / app.json / app.wxss   # 小程序入口与全局配置
├── pages/                        # 主包页面（Tab）
│   ├── discover/                 # 菜谱列表 + 当前菜单
│   └── mine/                     # 历史菜单
├── custom-tab-bar/               # 自定义底部 Tab
├── package-cook/                 # 业务分包：详情 / 汇总 / 菜单详情
│   └── pages/
│       ├── detail/               # 菜品做法图 + 加入菜单
│       ├── summary/              # 备料汇总（菜品图 / 合并清单）
│       └── menu-detail/          # 某次历史菜单详情
├── package-recipes/              # 菜谱数据分包（正文 Markdown + 本地 WebP 封面）
│   ├── aquatic / breakfast / …   # 按分类
│   ├── meat-0 … meat-3           # 荤菜分片（控制单包体积）
│   ├── staple-0 / staple-1
│   └── veg-0 / veg-1
├── data/
│   └── dishes.js                 # 全量菜品索引（名称、分类）
├── utils/                        # 主包工具：购物车、封面路径、分包预热、用量归并等
├── scripts/                      # 本地构建脚本（不打进小程序包）
├── images/                       # Tab 图标等静态资源
└── package.json                  # 仅本地脚本依赖（如 sharp）
```

### 分包怎么分

| 包 | 作用 |
| --- | --- |
| 主包 `pages/` | Tab：菜谱、我的 |
| `package-cook` | 详情、备料汇总、历史菜单详情 |
| `package-recipes/*` | 每类菜的 Markdown 正文 + `images/dishes/` 下 WebP 封面；大类再分片以免超过 2MB |

封面默认走**本地 WebP**（见 `utils/constants.js` 的 `DISH_COVER_MODE`），失败时回退远程图床。

## 本地运行

1. 用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)打开本仓库根目录
2. 使用自己的 AppID（或测试号）
3. 编译预览即可；首次进入某分类会下载对应菜谱分包

> `npm install` / `node_modules` 只给本地脚本用（压缩图、补封面），已在打包忽略列表中，**不会打进小程序**。

## 常用脚本（可选）

在项目根目录：

```bash
npm install
npm run fill:covers          # 补全缺失的本地封面并压成 WebP
npm run compress:dishes:webp # 批量压缩已有配图为 WebP
node scripts/bundle-recipes.mjs --images-only   # 从远程拉取缺失 JPEG 封面
node scripts/bundle-recipes.mjs --md-only       # 仅更新菜谱正文
```

## 数据与隐私

- 菜单、历史、清单勾选状态保存在 `wx.storage`，不上传服务器
- 无账号体系；清缓存会丢失本地菜单数据

## 致谢

- [Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook) — 菜谱正文
- [king-jingxiang/HowToCook](https://github.com/king-jingxiang/HowToCook) — 配图与菜单整理参考
