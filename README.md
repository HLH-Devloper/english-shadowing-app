# english-shadowing-app

本项目是一个英语跟读练习播放器，支持本地视频与字幕文件，同时支持 TED 官方嵌入播放。

## 发布到 GitHub

你可以使用随项目提供的 PowerShell 脚本一键创建仓库并推送：

1. 在本地初始化并提交（如果尚未初始化）：
   - `git init`
   - `git add .`
   - `git commit -m "Initial import"`
   - `git branch -M main`

2. 设置环境变量（当前会话示例）：
   - `$env:GITHUB_USERNAME = "your-username"`
   - `$env:GITHUB_TOKEN = "ghp_xxx"`  （PAT 需包含 `repo` 权限）
   - `$env:REPO_NAME = "english-shadowing-app"`

3. 运行脚本：
   - `pwsh ./scripts/publish-github.ps1`

脚本会通过 GitHub API 创建仓库（若不存在），自动绑定 `origin` 并推送 `main` 分支。

### 使用 GitHub CLI（可选）

如果已安装 `gh` 并完成登录：

- `gh repo create english-shadowing-app --private --source . --remote origin --push`

## 部署到 Vercel（生产环境）

本项目为 Vite + React SPA，已提供 `vercel.json` 用于：
- 将无扩展名的路由（如 `/player`、`/register`）回退到 `index.html`
- 为静态资源设置长缓存头（immutable）

部署与配置详见：
- `docs/deployment-vercel.md`

环境变量（在 Vercel → Settings → Environment Variables 设置）：
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

错误页：
- `public/404.html` 与 `public/500.html`

Firebase 规则示例：
- `firebase/firestore.rules`（在控制台中替换管理员 UID 后发布）
