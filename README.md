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

### 🎈 方案 A：Cloudflare Pages 原生部署 (最推荐，纯白嫖)

由于 NuxtHub Admin 服务近期调整升级，我们现在直接拥抱原生的 Cloudflare Pages 自动部署！这同样能永久享受全球边缘节点和完全免费的 D1 数据库服务，并且**不需要任何繁琐的指令**。

#### 第一步： Fork 仓库
1. 点击本项目右上角的 **Fork** 按钮，将本仓库克隆到您的个人 GitHub 账号下。

#### 第二步： 在 Cloudflare 关联部署 (全自动)
1. 访问 [Cloudflare 控制台](https://dash.cloudflare.com/) 并登录您的账号。
2. 在左侧导航栏找到 **Workers & Pages (Workers 和 Pages)**。
3. 点击 **Create (创建)**，在弹出的页面顶部切换到 **Pages** 选项卡。
4. 点击 **Connect to Git (连接到 Git)**，授权您的 GitHub，然后选择刚才 Fork 下来的 `PinPoint` 仓库。
5. 在 **Set up builds and deployments (构建和部署设置)** 环节：
   - **Framework preset (框架预设)**: 选择 **Nuxt.js**。
   - **Build command (构建命令)**: 填入 `pnpm run build`。
   - **Build output directory (构建输出目录)**: 保持默认即可，通常在选择框架后系统会自动配置好。
6. 点击 **Save and Deploy (保存并部署)**。

*（注：在点击部署的瞬间，隐藏在底层的 `@nuxthub/core` 核心会自动帮您在 Cloudflare 云端创建一个 D1 数据库并连接好一切资源，全程无需你动手写一句 SQL！）*

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
> 答：当你按照 `方案A` 在 Cloudflare 控制台连接 Git 并点击部署后，Cloudflare Dashboard 会实时显示编译终端。未来更新了代码，你可以直接在 Cloudflare 面板中的你的 Pages 项目里查看最近的一次部署日志。如果是红字请在控制台排查错误。

**Q2：地图完全刷不出来，定位一片白？**
> 答：大概率是未正确配置 `.env` 里的 `NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN` 或者用错了 Provider 名称。去 mapbox.com 注册之后会有一串 `pk.` 开头的序列号。

**Q3：我想用非本地的方式，把老早的几万张图片托管出去怎么办？**
> 答：本应用不仅支持 Local 模式，还在代码底层打通了 S3 的 S3Client。修改 `.env` 的配置项开启 `NUXT_STORAGE_PROVIDER=s3` 即可利用腾讯云对象存储/阿里云 OSS，极大地节省本地硬盘空间，未来还将拓展开放专门的扫描端。

## 📄 授权与鸣谢

本项目是由底层优秀基石方案 [ChronoFrame](https://github.com/simonno3/chronoframe) 重塑改造而来的衍生态产品，专用于多维度的自动装载兼容与更加云端原生的边缘网络优化体验。采用 [MIT](LICENSE) 原则。

维护者与联络: [@nianshu2022](https://github.com/nianshu2022)
