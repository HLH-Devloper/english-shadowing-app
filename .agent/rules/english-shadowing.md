---
trigger: always_on
---

你现在要遵守一套「安全发布规则」，请后续都按这套流程来改代码和部署，尤其是我这个 english-shadowing-app（跟读鸭）项目：
项目信息
Git 仓库：GitHub 仓库 HLH-Devloper/english-shadowing-app
Vercel 项目：english-shadowing
正式域名：https://www.speakduck.com
当前 Production 部署的 Source（分支）：main
严格禁止直接动生产分支
绝对不要在本地或远程对 main 分支做以下操作：
不要强制 push（禁止 git push --force 到 main）
不要直接在 main 上大量改代码并 push
不要修改 Vercel 上与 Production 相关的设置
你的原则：main 代表线上稳定版本，只能通过我手动合并 Pull Request 的方式更新，你不能自己触碰生产环境。

所有新功能一律在「功能分支」开发 + 走 Vercel Preview 环境
当我说“要加一个新功能（比如点击字幕查词、语音评分等）”时，你必须按以下步骤操作：
从 main 新建分支，命名规范：feature/xxx
比如：feature/dict-popup、feature/voice-score 等

命令示例：
git checkout main
git pull
git checkout -b feature/功能名
所有代码修改都只在这个 feature/... 分支上进行。
修改完成后：
git add .
git commit -m "feat: 描述本次改动"
git push origin feature/功能名
推到 GitHub 后，Vercel 会自动为这个分支创建一个 Preview 部署，生成一个类似
https://english-shadowing-git-feature-功能名-xxxxx.vercel.app 的预览链接。

这个链接只能算测试环境，不会影响 www.speakduck.com。
你在输出说明时，要明确告诉我“去这个 Preview 链接测试”。
环境变量与有道词典
我已经在 Vercel 的 Environment Variables 中配置了：
YOUDAO_APP_KEY
YOUDAO_APP_SECRET
你在写任何调用 /api/dict 的代码时，都要假设：
这些值只能在服务端（serverless function）里读取，不能暴露到前端。
Preview 环境和 Production 环境都有这些变量，所以在 Preview 部署上就可以完整测试“点击字幕查词”的真实行为。
如果本地开发（npm run dev）时 /api/dict 不可用，你可以：
给出友好报错；
或使用备用字典 API 兜底；
但不要改变线上（Vercel）对 /api/dict + 有道接口的调用逻辑。

你的输出与说明要求
当你完成某个功能（比如“字幕点击查词弹窗”）的代码改动后，在回复中必须清楚写明：
本次改动所在的 Git 分支名（例如 feature/dict-popup）。
需要我去 Vercel 里查看的 Preview 部署说明（例如提示我去看 Environment = Preview、Source = 该分支名那条）。
告诉我：“只有当你在 GitHub 把 feature 分支合并到 main 后，Vercel 才会自动更新 Production（speakduck.com），在此之前用户不会看到这些改动。”
不要替我合并 PR，不要帮我触发 Production 部署，你只需要给出“如何在 Preview 环境测试”的说明即可。

总结你的行为原则（很重要）：
你可以帮我：
在新建的 feature/... 分支上写代码、提交并 push；
为新功能设计后端接口、前端逻辑；
告诉我如何在 Vercel 的 Preview 部署中测试；
但你不能：
直接改动 main 分支上的代码；
直接触发或修改与 Production 环境有关的配置；
替我合并 feature 分支到 main。只有我明确告诉你要合并，你才可以合并。
请你完全按照以上规则工作。接下来无论我让你实现什么新功能（包括点击字幕查词功能），你都要默认使用“新建 feature 分支 → push → 在 Vercel Preview 上测试 → 我自己决定何时合并到 main”这一条流程。