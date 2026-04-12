# PinPoint

<div align="center">
  <img src="public/logo.png" width="120" alt="PinPoint Logo" />
  <p>您的自托管照片库，珍藏美好回忆。</p>
  <p>基于 <a href="https://github.com/simonno3/chronoframe">ChronoFrame</a> 二次开发的现代化重构版。</p>
</div>

## ✨ 简介

**PinPoint** 是一款支持多端访问、完全自托管的个人回忆照片库。
不仅具备精美的瀑布流布局，还能自动为您提取照片里的 EXIF（快门、光圈、相机型号等）信息，并在交互式地图上全景展示您的足迹打卡！

### 🚀 核心特性

- **视觉至上**：美观且响应式的瀑布流展示，针对手机与电脑端专门设计。
- **地图探索**：接入动态交互地图，轻松回看过去走过的山川湖海。
- **智能元数据解析**：自动摘取地理时间、设备信息，自动逆向生成物理定位（如“广东省 深圳市”）。
- **实况兼容**：原生态完美支持苹果 HEIC 高效图片格式，并可激活 `.mov` 展现完美 Live Photos 照片实况！
- **多端存储引擎**：不仅支持最纯正的服务器本地硬盘存储，更为 Serverless 玩家深度接入 Cloudflare (D1等内置无服务特性)、S3（腾讯云 COS, Minio, AWS）。

---

## ☁️ 部署指南 (详细篇)

本系统在设计时充分考虑了不同的玩家群体，从云端白嫖到软路由本地自建，都有专门优化打磨过的流程。请根据您的习惯选择！

### 🎈 方案 A：Cloudflare Serverless 部署 (最推荐，纯白嫖)

如果您没有自己的服务器，或者不想忍受服务器高昂的带宽费，推荐使用免费且全球分布的 Cloudflare 边缘节点网络。

本仓库配置了利用 `NuxtHub` 发推的自动化 `GitHub Actions`，只需配置一次，后续写了新代码自动更新。

#### 第一步： Fork 仓库
1. 点击本项目右上角的 **Fork** 按钮，将本仓库克隆到您的个人 GitHub 账号下。

#### 第二步： 获取 NuxtHub 部署密钥
1. 访问 [NuxtHub Admin](https://admin.hub.nuxt.com/)。
2. 使用您的 GitHub 账号进行授权登录。
3. 进入控制台右上方点击 **Add Project** (或 New Project)。
4. 在仓库列表中，选择您刚刚 Fork 过来的 `PinPoint` 仓库进行关联。
5. 一旦关联完成，进入项目主页的 **Settings (设置)** 面板，找到 **Project Key** 这一项（一般是一串形如 `nuxthub_xxxx...` 的字符串），把它复制下来。

*(注：NuxtHub 会在部署时，自动为您在 Cloudflare 中创建必需的 D1 数据库，所有数据都存在您的私人账户中，无须您手动敲 SQL 建表)*

#### 第三步： 配置 GitHub 自动工作流
1. 回到您个人的 GitHub 仓库。
2. 点击顶部的 **Settings** 选项卡。
3. 在左侧菜单寻找 **Security** -> **Secrets and variables** -> **Actions**。
4. 点击绿色的 **New repository secret** 按钮。
5. **Name (名字)** 必须完全一致填写：`NUXT_HUB_PROJECT_KEY`
6. **Secret (内容)** 里填入您上一步拷贝粘贴的 Key 字符串。
7. 点击保存。

现在，您的专属自动化已经接通！为了触发第一次打包，你可以去改一下您项目里任意文件的内容，或者直接通过 GitHub Actions 的界面手动 (`workflow_dispatch`) 点击 **Run workflow** 触发部署 `Deploy to Cloudflare Pages (NuxtHub)` 工作流。部署成功后即可获得 Cloudflare 免费分配的访问域名。

---

### 🐳 方案 B：Docker / 群晖 / NAS 自有私有云部署

如果您有自己的闲置 VPS 服务器、群晖设备或者软路由，并且习惯用 Docker：

#### 第一步：准备必要文件与路径

在您服务器的随便一个目录（例如 `/opt/pinpoint`），新建两个文件：`docker-compose.yml` 和 `.env`。由于涉及到数据库和存储落盘，我们还需要为映射准备一个用于存数据的目录：

```bash
mkdir -p /opt/pinpoint/data
cd /opt/pinpoint
```

#### 第二步：创建 `docker-compose.yml` 配置

在刚才的目录新建 `docker-compose.yml`，并输入以下内容。由于我们已经配置了 GitHub 帮你打包了镜像，您可以直接使用别人造好的轮子：

```yaml
version: '3.8'
services:
  pinpoint:
    # 如果镜像拉取慢，可以考虑使用你的私服或其他源
    # 注意把 `nianshu2022` 换成你对应账号的名字，如果你 Fork 后自行打了 tag 的话。
    image: ghcr.io/nianshu2022/pinpoint:latest
    container_name: pinpoint
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # 我们将容器内的 /app/data 映射到了刚才外面的 ./data
      # 所有的 SQLite 数据库以及图片原图缩略图都会保存在这里，防止重启丢失！
      - ./data:/app/data
    env_file:
      - .env
```

#### 第三步：编写核心 `.env` 变量配置文件

这是核心！新建 `.env`：

```bash
# =========================
# 必须配置项
# =========================

# 数据加密用随机盐，必须设置一个至少 32 位的长字符串
NUXT_SESSION_PASSWORD=replace_with_a_very_long_secure_random_string_32_chars

# 设置你的管理员原始账号（如果没有设置，进入系统默认账密是 admin@chronoframe.com 和 CF1234@!）
CFRAME_ADMIN_EMAIL=my_email@qq.com
CFRAME_ADMIN_NAME=Admin
CFRAME_ADMIN_PASSWORD=my_cool_password

# =========================
# 可选功能：地图（如需展示足迹地图必填）
# =========================

# 使用 Mapbox，去 Mapbox 官网免费注册并获取 Access Token
NUXT_PUBLIC_MAP_PROVIDER=mapbox
NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eYxxxxxxxxxxxxxxxxx
NUXT_MAPBOX_ACCESS_TOKEN=sk.eYxxxxxxxxxxxxxxxxx  # Reverse Encoder 专用（后端用）

# =========================
# 可选功能：自定站点信息
# =========================
NUXT_PUBLIC_APP_TITLE=我的云端回忆
NUXT_PUBLIC_APP_SLOGAN=珍藏那一抹光景
```

#### 第四步：一键启动

在该目录下执行启动命令拉取镜像：

```bash
docker-compose up -d
```
启动之后，通过浏览器访问服务器 IP 和对应端口 `http://<服务器IP>:3000` 即可进入专属您的图库世界！

---

## 📖 新手使用流程必读

成功进入页面后，第一步我们需要**上传照片**。

1. 点击网页右侧的**用户头像**登录后台系统。
2. 登录后通过侧边栏点击进入 **Dashboard (控制面板)**。
3. 找到 **Photos** 功能页，点击上传按钮。（此时您可以多选图片，甚至可以拖拽文件放入！）
4. **实况照片(Live Photo) 小贴士**：
   如果您想保留 iPhone 拍摄的会动的实况照片，请确保上传时，**将对应的 `.heic` 图像文件和 `.mov` 短片段同名一并上传**。（比如 `IMG_8848.heic` 和 `IMG_8848.mov`）。上传后不必惊慌，系统在后台扫描完毕后会自动将两者“配对缝合”，在前端展现出可长按查看动画的震撼效果！

---

## 🛠️ 二次开发与本地构建

对于各位热爱代码的极客开发者：

### 环境前置
- Node.js 20+
- 包管理器 `pnpm 10.x+` (强烈禁止使用 npm/yarn 造成依赖锁串台)

### 研发启动步骤
```bash
git clone https://github.com/nianshu2022/PinPoint.git
cd PinPoint

# 安装全部底层依赖（含 C++ 原生构建件处理如 sharp 等）
pnpm install

# (非必须) 只有当你改了 Drizzle Scheme 设计表结构时
pnpm db:generate

# 开启带有热更新的本地调试服务器！
pnpm dev
```
此时 `localhost:3000` 就是属于你的代码游乐场！

---

## 💬 疑难解答与 FAQ

**Q1：如何知道我的 Cloudflare 部署好没？我该去哪里看日志？**
> 答：当你做完 `方案A` 的 GitHub Actions 设置后，你可以点击你 GitHub 仓库上方的 **Actions** 菜单栏，点击进那一项查看每一步日志。里面如果有红字 Error 请认真读取。成功以后，在 NuxtHub 面板也能直观查看到云端资源监控。

**Q2：地图完全刷不出来，定位一片白？**
> 答：大概率是未正确配置 `.env` 里的 `NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN` 或者用错了 Provider 名称。去 mapbox.com 注册之后会有一串 `pk.` 开头的序列号。

**Q3：我想用非本地的方式，把老早的几万张图片托管出去怎么办？**
> 答：本应用不仅支持 Local 模式，还在代码底层打通了 S3 的 S3Client。修改 `.env` 的配置项开启 `NUXT_STORAGE_PROVIDER=s3` 即可利用腾讯云对象存储/阿里云 OSS，极大地节省本地硬盘空间，未来还将拓展开放专门的扫描端。

## 📄 授权与鸣谢

本项目是由底层优秀基石方案 [ChronoFrame](https://github.com/simonno3/chronoframe) 重塑改造而来的衍生态产品，专用于多维度的自动装载兼容与更加云端原生的边缘网络优化体验。采用 [MIT](LICENSE) 原则。

维护者与联络: [@nianshu2022](https://github.com/nianshu2022)
