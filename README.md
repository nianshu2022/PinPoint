# PinPoint

<div align="center">
  <img src="public/logo.png" width="120" alt="PinPoint Logo" />
  <p>您的自托管照片库，珍藏美好回忆。</p>
  <p>基于 ChronoFrame 二次开发。</p>
</div>

## ✨ 简介

**PinPoint** 是一款自托管的个人照片库应用，旨在帮助您组织和展示珍贵的照片回忆。它支持自动提取 EXIF 信息、在交互式地图上展示拍摄位置，并提供美观的瀑布流布局。

> 本项目基于 [ChronoFrame](https://github.com/simonno3/chronoframe) 二次开发。

## 🚀 特性

- **瀑布流布局**：美观且响应式的照片展示
- **地图视图**：在地图上探索您的照片足迹
- **EXIF 解析**：自动提取并展示拍摄参数
- **S3 兼容**：支持各类 S3 兼容对象存储 (AWS, 腾讯云 COS, MinIO 等)
- **高性能**：基于服务端渲染 (SSR) 和图片优化技术
- **隐私优先**：完全自托管，数据掌握在自己手中

### 🖼️ 强大的图片管理

- **在线管理照片** - 通过 Web 界面轻松管理和浏览照片
- **探索地图** - 在地图上浏览照片拍摄位置
- **智能 EXIF 解析** - 自动提取拍摄时间、地理位置、相机参数等元数据
- **地理位置识别** - 自动识别(Reverse Geocoding)照片拍摄地点
- **多格式支持** - 支持 JPEG、PNG、HEIC/HEIF 等主流图片格式
- **智能缩略图** - 基于 ThumbHash 技术的高效缩略图生成

### 🔧 现代技术栈

- **Nuxt 4** - 基于最新的 Nuxt 框架，提供 SSR/SSG 支持
- **TypeScript** - 完整的类型安全保障
- **TailwindCSS** - 现代化的 CSS 框架
- **Drizzle ORM** - 类型安全的数据库 ORM

### ☁️ 灵活的存储方案

- **多存储后端** - 支持 S3 兼容存储、本地文件系统
- **CDN 加速** - 可配置 CDN 地址加速图片访问

## 🐳 部署

推荐使用 Docker 部署。

创建 `.env` 文件并配置。

下面是**最小化配置**示例：

```bash
# 管理员邮箱（必须）
CFRAME_ADMIN_EMAIL=
# 管理员用户名（可选，默认 PinPoint）
CFRAME_ADMIN_NAME=
# 管理员密码（可选，默认 CF1234@!）
CFRAME_ADMIN_PASSWORD=

# 站点信息（均可选）
NUXT_PUBLIC_APP_TITLE=
NUXT_PUBLIC_APP_SLOGAN=
NUXT_PUBLIC_APP_AUTHOR=
NUXT_PUBLIC_APP_AVATAR_URL=

# 地图提供器 (maplibre/mapbox)
NUXT_PUBLIC_MAP_PROVIDER=maplibre
# 使用 MapLibre 需要 MapTiler 访问令牌
NUXT_PUBLIC_MAP_MAPLIBRE_TOKEN=
# 使用 Mapbox 需要 Mapbox 访问令牌
NUXT_PUBLIC_MAPBOX_ACCESS_TOKEN=

# Mapbox 无域名限制令牌（反向地理编码，可选）
NUXT_MAPBOX_ACCESS_TOKEN=

# 存储提供者（local、s3 或 openlist）
NUXT_STORAGE_PROVIDER=local
NUXT_PROVIDER_LOCAL_PATH=/app/data/storage

# 会话密码（必须，32 位随机字符串）
NUXT_SESSION_PASSWORD=
```

### Docker

一行命令启动：

```bash
docker build -t withyou .
docker run -d --name withyou -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env withyou
```

### Docker Compose（推荐）

创建 `docker-compose.yml`：

```yaml
services:
  withyou:
    build: .
    container_name: withyou
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ./data:/app/data
    env_file:
      - .env
```

启动：

```bash
docker-compose up -d
```

## 📖 使用指南

> 如未配置 `CFRAME_ADMIN_EMAIL` 和 `CFRAME_ADMIN_PASSWORD`，默认账号如下：
>
> - 邮箱: `admin@chronoframe.com`
> - 密码: `CF1234@!`

### 登录到控制台

1. 点击头像跳转到登录页面，可以使用账号密码或 GitHub 登录

### 上传照片

1. 访问仪表板页面 `/dashboard`
2. 在 `Photos` 页面中选择图片并点击上传（支持批量上传和拖拽上传）
3. 系统将自动提取 EXIF 信息、生成缩略图并逆编码照片地理位置

## 📸 截图

![Gallery](./docs/images/screenshot1.png)
![Photo Detail](./docs/images/screenshot2.png)
![Map Explore](./docs/images/screenshot3.png)
![Dashboard](./docs/images/screenshot4.png)

## 🛠️ 开发

### 环境要求

- Node.js 18+
- pnpm 9.0+

### 安装依赖

```bash
# 使用 pnpm (推荐)
pnpm install

# 或使用其他包管理器
npm install
yarn install
```

### 配置环境变量

复制环境变量模板并根据需要配置：

```bash
cp .env.example .env
```

### 数据库初始化

```bash
# 2. 生成数据库迁移文件(可选)
pnpm db:generate

# 3. 执行数据库迁移
pnpm db:migrate
```

### 启动开发服务器

```bash
pnpm dev
```

应用将在 `http://localhost:3000` 启动。

### 项目结构

```
withyou/
├── app/                    # Nuxt 应用
│   ├── components/         # 组件
│   ├── pages/              # 页面路由
│   ├── composables/        # 组合式函数
│   └── stores/             # Pinia 状态管理
├── packages/
│   └── webgl-image/        # WebGL 图片查看器
├── server/
│   ├── api/                # API 路由
│   ├── database/           # 数据库 schema 和迁移
│   └── services/           # 业务逻辑服务
└── shared/                 # 共享类型和工具
```

### 构建命令

```bash
# 开发模式 (包含依赖包构建)
pnpm dev

# 仅构建依赖包
pnpm build:deps

# 构建生产版本
pnpm build

# 数据库操作
pnpm db:generate    # 生成迁移文件
pnpm db:migrate     # 执行迁移

# 预览生产版本
pnpm preview
```

## 🤝 贡献

欢迎贡献代码！请确保：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

### 开发规范

- 使用 TypeScript 进行类型安全的开发
- 遵循 ESLint 和 Prettier 代码规范
- 更新相关文档

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 👤 作者

**nianshu2022**

- GitHub: [@nianshu2022](https://github.com/nianshu2022)
- 项目地址: [WithYou](https://github.com/nianshu2022/WithYou)

## ❓ FAQ

<details>
  <summary>如何创建管理员用户？</summary>
  <p>
    首次启动时，会根据环境变量 <code>CFRAME_ADMIN_EMAIL</code>、<code>CFRAME_ADMIN_NAME</code> 和 <code>CFRAME_ADMIN_PASSWORD</code> 环境变量创建一个管理员用户。<code>CFRAME_ADMIN_EMAIL</code> 必须是登录使用的 GitHub 账户的邮箱。
  </p>
</details>
<details>
  <summary>支持哪些图片格式？</summary>
  <p>
    支持 JPEG、PNG、HEIC/HEIF、MOV(作为实况照片) 格式。
  </p>
</details>
<details>
  <summary>为什么无法使用 GitHub/Local 存储？</summary>
  <p>
    目前支持 S3 兼容存储，未来计划支持 GitHub 和本地文件系统存储。
  </p>
</details>
<details>
  <summary>为什么需要/如何配置地图服务？</summary>
  <p>
    地图服务用于在地图上浏览照片拍摄位置，以及照片详情中的小地图渲染。目前使用 Mapbox，注册后<a href="https://console.mapbox.com/account/access-tokens/">获取访问令牌</a>并配置到 <code>MAPBOX_TOKEN</code> 环境变量中。
  </p>
</details>
<details>
  <summary>为什么我上传的 MOV 文件没有被识别为实况照片？</summary>
  <p>
    需要确保实况照片对的图片(.heic)和视频(.mov)的文件名一致（例如 <code>IMG_1234.heic</code> 与 <code>IMG_1234.mov</code> 会自动匹配）。
    一般情况来说，不管是上传 .heic 还是 .mov，都会检测一次配对，因此上传的顺序无关紧要。
    如果仍然没有被识别为实况照片，请在仪表盘中找到图片，在操作菜单中手动触发配对检测。
  </p>
</details>
<details>
  <summary>如何导入存储中已有的照片？</summary>
  <p>
    目前不支持直接导入已有照片，未来计划支持通过指定目录扫描导入。
  </p>
</details>
<details>
  <summary>本项目与 Afilmory 有何区别？</summary>
  <p>
    Afilmory 是一个非常优秀的项目，其部署方式是在本地或 CI 中处理存储中的照片并生成清单文件，然后前端通过读取清单文件来展示照片，属于静态部署。
    ChronoFrame 则是一个动态的照片管理应用，提供在线上传、管理和浏览照片的功能，适合需要频繁更新照片的场景。
  </p>
</details>

## 🙏 致谢

本项目基于 [ChronoFrame](https://github.com/simonno3/chronoframe) 二次开发。

感谢以下优秀的开源项目和库：

- [ChronoFrame](https://github.com/simonno3/chronoframe) - 原始项目
- [Nuxt](https://nuxt.com/)
- [TailwindCSS](https://tailwindcss.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
