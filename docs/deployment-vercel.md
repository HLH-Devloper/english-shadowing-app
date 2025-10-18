# 生产环境部署（Vercel）

本项目为 Vite + React 单页应用（SPA）。后端依赖 Firebase（Auth + Firestore）。以下为面向生产的部署与检查指南。

## 一、在 Vercel 创建项目

1. 登录 Vercel，导入 GitHub 仓库 `HLH-Devloper/english-shadowing-app`。
2. 框架选择：`Vite`（或保持默认自动识别）。
3. 构建命令：`npm run build`；输出目录：`dist`（已在 `vercel.json` 配置）。
4. 环境（Environment）：启用 `Production` 与 `Preview` 两个环境。

> 本仓库已提供 `vercel.json`：
> - 路由回退到 `index.html`（仅对无扩展名的路径，如 `/player`）
> - 为静态资源设置长缓存头（`immutable`）
> - 为 `index.html` 设置 `must-revalidate`

## 二、环境变量（Vercel → Settings → Environment Variables）

在 `Production` 与 `Preview` 环境分别设置以下变量（与 `src/firebase.js` 一致）：

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

说明：带 `VITE_` 前缀的变量会在编译期注入到客户端（`import.meta.env`）。注意不要把敏感凭据提交到仓库。

## 三、域名与访问

- 先使用 Vercel 提供的免费域名，形如 `https://english-shadowing-app.vercel.app`。
- 如需自定义域名，在 Vercel 项目 `Domains` 面板添加你的域名，按提示在域名服务商配置 `A` / `CNAME` 记录。

## 四、Firebase（生产项目指向与规则）

- 确认 `src/firebase.js` 的配置来自生产环境（见上面的环境变量）。
- 在 Firebase 控制台 → Firestore → 规则，使用本仓库 `firebase/firestore.rules` 作为基线：
  - 仅允许用户读写自己的 `users/{uid}` 文档。
  - 允许用户在占用未使用的邀请码时，更新 `inviteCodes/{code}` 的 `isUsed=true、usedBy、usedAt`。
  - 批量创建或修复邀请码仅限管理员（修改规则中的管理员 UID）。

> 提示：客户端的会员升级逻辑使用事务（同时占用邀请码并更新用户文档）；生产中请为管理员保留邀请码种子入口，仅在受控环境操作。

## 五、静态资源与错误页面

- `public/404.html` 与 `public/500.html`：在 Vercel 静态站点中用于资源缺失与服务器错误反馈。
- `public/duck-follow-me.png` 等静态资源会自动复制到 `dist/` 并长期缓存。
- 字典文件：`public/dict/en-basic.json`，播放器需要时按需加载。

## 六、基本 SEO 设置

- 已在 `index.html` 添加：`description`、OpenGraph、Twitter Card、`canonical`、`theme-color` 与 `favicon`。
- 部署后可用 `https://cards-dev.twitter.com/validator` 与 `https://ogp.me/` 进行校验。

## 七、上线前检查清单（Preflight Checklist）

- 构建产物
  - `npm run build` 成功，`dist/` 生成且体积合理（无巨大未压缩文件）。
- 环境变量
  - Vercel 的 `Production` 与 `Preview` 环境均已配置完整的 `VITE_FIREBASE_*`。
- 路由与回退
  - 直接访问 `/`, `/register`, `/player` 正常渲染（无 404）；静态资源路径如 `/dict/en-basic.json` 可直接访问。
- 错误页面
  - 访问不存在的静态文件触发 `404.html`；模拟服务器错误时展示 `500.html`。
- SEO
  - 页面 `<head>` 元标签正确，`canonical` 指向生产域名；OG/Twitter 预览正常。

## 八、功能验证（按用户流程）

- 注册/登录
  - 邮箱注册：创建用户文档；登录成功后跳转首页并提示。
  - Google 登录：首次登录创建 `free` 文档；重复登录更新 `lastLogin`。
  - 邀请码：使用合法且未过期的 code，事务更新 `inviteCodes`（`isUsed`、`usedBy`、`usedAt`）并将用户 `membership=member`。
- 视频播放与跟读
  - 本地视频：上传后正常播放；字幕解析（SRT/ASS/VTT/SSA）正常；控制条、练习弹窗工作正常。
  - TED 嵌入：根据 `tedTalkId` 正常播放；跟读与句子定位正常。
- 字幕上传与解析
  - 双语分行与管道分隔（`|`）格式解析正确；ASS 去除样式标签、`
` 转换正常。
- 响应式设计
  - 在手机（375–430 宽）、平板（768–1024 宽）、桌面（>=1280 宽）布局无错位；交互可点击区域足够大。

## 九、上线后的验证步骤（Production Validation）

- 访问监控
  - Vercel Analytics（如启用）与浏览器控制台无重大报错；请求状态 200/304 为主。
- Firebase
  - Firestore 控制台：`users/{uid}` 与 `inviteCodes/{code}` 的读写与规则命中符合预期；无拒绝日志。
- 性能与资源
  - 首屏时间与交互延迟可接受；静态资源命中 `immutable` 缓存；字典 JSON 按需加载。
- 安全
  - 所有写操作均由登录用户发起；无跨用户写入；管理员批量操作通过受控入口进行。
- 回归测试
  - 注册/登录、跟读弹窗、字幕切换、进度条拖动与限制提示等核心功能无异常。

## 十、常见问题

- `Fine-grained` PAT 无法创建仓库：请先在 GitHub 手动创建仓库并绑定 `origin` 后再推送（脚本已支持此路径）。
- 路由 404：确保 `vercel.json` 中的 `rewrites` 已部署且路径不包含扩展名（例如 `/player`）。
- Firebase 配置不生效：检查 Vercel 的环境变量在 `Production` 与 `Preview` 都已设置；重新触发构建后生效。