# 玄机阁 → Vercel 一键部署教程（免费、永久、微信可打开）

> 本教程把玄机阁部署到 Vercel 全球免费平台，**完全脱离扣子**，部署完拿到一个 `xxx.vercel.app` 网址，可以直接复制粘贴到微信、QQ、朋友圈分享。**永久免费**，个人项目流量额度 100GB/月完全够用。

---

## 你需要准备的三样东西

| 资源 | 哪里弄 | 花多少时间 |
|---|---|---|
| **GitHub 账号** | https://github.com 注册（免费）| 2 分钟 |
| **Vercel 账号** | https://vercel.com 用 GitHub 登录即可（免费）| 30 秒 |
| **阿里云百炼 API Key** | https://bailian.console.aliyun.com 申请（有免费额度）| 5 分钟 |

> 不需要服务器、不需要域名、不需要备案、不需要绑信用卡。

---

## 五步上线（预计 10 分钟）

### 第 1 步：把代码推到 GitHub

如果你不熟悉 git，最简单办法是用 GitHub 网页版上传：

1. 登录 GitHub → 右上角「+」→ **New repository**
2. 仓库名填 `xuanjige`，**勾选 Private**（私有，不公开你的代码）
3. 点 **Create repository**
4. 在新仓库页面点 **uploading an existing file**
5. 把玄机阁项目的所有文件**整个拖进去**（不要拖 `node_modules` 和 `.next` 文件夹，太大）
6. 点 **Commit changes** 等上传完成

如果你会用 git，直接：

```bash
cd /path/to/玄机阁
git init
git add .
git commit -m "初始化"
git branch -M main
git remote add origin https://github.com/你的用户名/xuanjige.git
git push -u origin main
```

### 第 2 步：在 Vercel 导入项目

1. 打开 https://vercel.com → 点右上角 **Login** → 选 **Continue with GitHub**
2. 登录成功后，主界面点 **Add New** → **Project**
3. 在仓库列表里找到 `xuanjige`，点旁边的 **Import**
4. 进入 Configure Project 页面，**不要急着点 Deploy**，先做第 3 步配置环境变量

### 第 3 步：配置环境变量（最关键的一步）

在 Configure Project 页面找到 **Environment Variables** 折叠板块，点开。逐条添加下面的变量（**Name** 是变量名，**Value** 是你的实际值）：

#### 必填项（缺一个 APP 就跑不起来）

| Name | Value | 从哪拿 |
|---|---|---|
| `LLM_API_KEY` | `sk-xxxxxxxxxxxxxxxxxxxxxxx` | 阿里云百炼控制台 → API-KEY 管理 |
| `LLM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 写死这个就行 |
| `LLM_MODEL` | `qwen-plus` | 推荐用 `qwen-plus`（性能/价格均衡）|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://你的项目.supabase.co` | Supabase 控制台 → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJxxxxx...`（很长一串）| 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJxxxxx...`（更长一串）| 同上，**注意是 service_role**，不是 anon |

#### 可选项（不填也能跑，只是某些功能受限）

| Name | Value | 不填会怎样 |
|---|---|---|
| `SEARCH_API_KEY` | Serper.dev 的 key | 添加书籍时只能用本地公版书源，搜不到大部分书 |
| `SEARCH_PROVIDER` | `serper` | 默认走 local 兜底 |
| `S3_ENDPOINT_URL` / `S3_BUCKET_NAME` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | 你的 S3 配置 | 不上传图片到 S3，走 base64 内嵌（页面会变慢）|

**Apply to** 三个环境（Production / Preview / Development）都勾上。

### 第 4 步：点 Deploy

环境变量填完，点页面底部蓝色的 **Deploy** 按钮。

Vercel 会自动：
1. 拉代码
2. 跑 `pnpm install`
3. 跑 `pnpm run build:vercel`（在 vercel.json 里指定）
4. 把 Next.js 编译产物丢到全球 CDN
5. 分配一个 `xuanjige-xxx.vercel.app` 域名

整个过程大概 2-5 分钟，页面会显示部署进度。

### 第 5 步：拿到网址，复制粘贴到微信

部署成功后页面会出现一个 **Visit** 按钮，点它进入你的 APP。地址栏的那个 `https://xuanjige-xxx.vercel.app` 就是你的**永久网址**。

复制这个网址，发到微信群、朋友圈、给朋友单聊都行：

```
🔮 玄机阁 - AI 玄学算命
https://xuanjige-xxx.vercel.app

（在微信里第一次打开会提示「非微信官方网页」，
 点右上角 ··· → 在浏览器中打开 即可）
```

---

## 部署完之后的验证清单

打开你的 `https://xuanjige-xxx.vercel.app/api/version`，应该看到类似这样的 JSON：

```json
{
  "buildId": "fix-add-book-500-v2",
  "builtAt": "2026-XX-XX...",
  "features": {
    "addBookForceDynamic": true,
    "ensureTaskManagerLazy": true,
    ...
  },
  "healthy": true
}
```

看到 `"healthy": true` 就说明部署成功了。

接下来逐个功能试一遍：

| 功能 | 测试方法 | 预期结果 |
|---|---|---|
| 首页 | 打开 `https://xuanjige-xxx.vercel.app` | 显示玄机阁主界面 |
| AI 问答 | 进首页点「AI 问答」问一个玄学问题 | 流式打字机输出回答 |
| 八字命理 | 进八字页面填出生日期 | 显示排盘 + AI 分析 |
| 紫微/六爻/梅花/奇门/大六壬/风水/姓名 | 各自页面输入测试 | 都能正常返回 |
| 添加书籍 | 输入「三命通会」点添加 | 任务创建成功，开始后台录入 |

**关于「添加书籍」在 Vercel 上的限制说明**：

Vercel 是 Serverless 平台，文件系统不持久（每次冷启动文件都会丢）。所以：

- ✅ **AI 问答、所有测算功能**：完全正常
- ✅ **基本的添加书籍流程**：能跑，数据存到 Supabase
- ⚠️ **`/api/book-entry` 本地 SQLite 兜底链路**：在 Vercel 上自动降级返回 503（这是预期行为，不是 bug）
- ⚠️ **后台长时间录入任务**：Vercel Serverless 函数有 60 秒上限，单次请求超时会中断；适合「快速测算」类短请求

如果你要在 Vercel 上跑大规模书籍录入，建议：
- 单次只录少量章节，分多次请求
- 或者迁到 Oracle Cloud / 自有服务器（看 `DEPLOY.md`）

---

## 后续修改：怎么发布新版本

代码改完后：

```bash
git add .
git commit -m "修改了 xx 功能"
git push
```

**就这一行**。Vercel 监听 GitHub，会自动拉新代码、自动 build、自动部署，1-3 分钟后线上就是新版了。

每次推送都会保留历史版本，你可以在 Vercel Dashboard 的 **Deployments** 标签页看到所有历史部署，点任意一个可以**一键回滚**到那个版本。

---

## 自定义域名（可选）

`xuanjige-xxx.vercel.app` 这个网址有点长。如果你想换成更简短好记的，可以：

1. **完全免费方案**：注册一个免费域名（见 `scripts/book-entry/README.md` 或访问 https://duckdns.org），在 Vercel Dashboard 的 **Settings → Domains** 里绑定即可（自动配 HTTPS，零成本）
2. **专业方案**：去阿里云/腾讯云买一个 `.com` 域名（约 60 元/年），在 Vercel 里绑定，配 CNAME 记录，自动配 HTTPS

绑定自定义域名后，**微信里打开不再弹「非官方」警告**（因为域名变成你自己的了）。

---

## 常见问题排查

### Q1：Vercel 部署失败，提示 build error

去 **Deployments** 标签页点失败的那次部署，查看构建日志。最常见的两种错误：

- `Cannot find module xxx`：依赖没装好，去 Settings → General 里重新点 Redeploy
- `Type error: ...`：TypeScript 错误，需要修代码

### Q2：部署成功但打开页面是 500

90% 是环境变量没配对。去 **Settings → Environment Variables** 检查：
- `LLM_API_KEY` 是不是真的阿里云百炼 key（不是其他地方的 key）
- `NEXT_PUBLIC_SUPABASE_URL` 是不是 `https://xxx.supabase.co` 完整格式
- `SUPABASE_SERVICE_ROLE_KEY` 是不是用了 service_role 而不是 anon

改完环境变量后**必须重新部署**（Vercel 不会自动重启），手动点 Deployments → 最新一次 → ··· → **Redeploy**。

### Q3：微信里打开提示「非微信官方网页」

这是微信对所有非微信生态网址的默认行为，不是你的问题。两种解决：

- 让朋友点右上角 ··· → **在浏览器中打开**（一键操作，无障碍）
- 或者绑自己的备案域名 + 接入微信公众号 JS-SDK（专业方案，要花钱花时间）

### Q4：免费额度会不会超？

Vercel 免费版限制：
- 100 GB 流量/月
- 100 GB-Hours 函数执行时长/月

假设每次 AI 问答耗 5 秒函数执行 + 100KB 流量响应，**100GB-Hours = 72000 次完整问答**。即使你和朋友每天用 100 次，一个月才 3000 次，**用不掉 5%**。

放心用。

---

## 总结

```
准备：GitHub 账号 + Vercel 账号 + 阿里云百炼 Key
第 1 步：把代码推到 GitHub
第 2 步：Vercel 导入项目
第 3 步：配环境变量
第 4 步：点 Deploy
第 5 步：拿网址，复制粘贴到微信

→ 永久免费，全球 CDN，自动 HTTPS，微信可打开
→ 与扣子彻底再见
```

**有任何一步卡住，截图给我，我直接帮你看具体怎么解决。**
