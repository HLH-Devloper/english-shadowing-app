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
