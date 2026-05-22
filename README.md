# 美术教育平台

面向小学美术教师的作品分析、评分、异常检测与成长追踪平台。

> 📢 **本项目已开源**，并作为**"创AI"参赛作品**报送。
> 欢迎学习、教学、学术研究与公益使用，但请**尊重原作者版权信息**：
> 转载、引用、二次开发请保留作者署名与本仓库链接，未经授权不得用于任何商业用途。
> 详见 [LICENSE](./LICENSE)（PolyForm Noncommercial 1.0.0）。

## 技术栈

- **后端**: Express + SQLite3 + JWT 鉴权,可选 MiniMax AI 集成
- **前端**: React 18 + Vite + Tailwind CSS + Zustand
- **测试**: Playwright (E2E) + Vitest (单元)

## 快速开始

```bash
cd art-edu-platform
npm install

# 配置环境变量(JWT 密钥不入库,需自行生成)
cp .env.example .env
# 在 .env 中设置 JWT_SECRET / JWT_REFRESH_SECRET / SETTINGS_ENCRYPTION_KEY
# 每个值用 openssl rand -base64 32 生成

npm run dev
# 后端:  http://localhost:8085
# 前端:  http://localhost:8086
```

首次运行会自动建库并写入种子数据(一所学校、一个班级、一个 admin、一个 teacher 账号)。
**种子脚本会在控制台打印随机生成的密码**,首次启动请及时记录。

`MINIMAX_API_KEY` 可选,留空时 AI 分析以 Mock 模式运行。

## 功能

- 班级 / 学生 / 作品管理(支持教师增删改查)
- AI 辅助作品评分:四个维度(色彩、构图、主题、表现)
- 异常检测(深色主导、主题偏离)
- 成长曲线、班级诊断、预警面板
- 教师复核与覆盖工作流

## 目录结构

```
art-edu-platform/
├── server/          Express API(routes / services / migrations)
├── src/             React 前端(pages / components / stores)
├── scripts/         辅助脚本(数据库备份、样例数据生成)
├── tests/           Playwright E2E 与 Vitest 单元测试
├── docs/            部署文档、产品说明书
└── public/          静态资源
```

## 文档

- `docs/部署文档.md` — 部署与运维指南
- `docs/产品说明书.md` — 产品功能与使用说明

## 许可

本项目采用 **PolyForm Noncommercial License 1.0.0**(详见 `LICENSE`)。

允许:个人学习、教学、学术研究、公益机构与政府机构使用,允许修改与再分发。
禁止:**任何商业用途**(包含但不限于商业销售、商业服务、商业产品集成、为商业组织提供服务等)。

商业授权请联系作者另行协商。
