import pkg from './package.json'
import tailwindcss from '@tailwindcss/vite'
import type { AnalyticsConfig } from './shared/types/config'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: [
    'reka-ui/nuxt',
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/test-utils',
    '@pinia/nuxt',
    'motion-v/nuxt',
    'nuxt-auth-utils',
    '@vueuse/nuxt',
    'dayjs-nuxt',
    '@nuxtjs/i18n',
    'nuxt-mapbox',
    'nuxt-maplibre',
    // nuxt-og-image 依赖 satori + @resvg/resvg-js (WASM)，在 Cloudflare Workers 中
    // 会使 bundle 超过 25MB 限制，故 CF 环境下禁用
    ...(process.env.CF_PAGES ? [] : ['nuxt-og-image']),
    'nuxt-gtag',
  ],

  css: [
    '@fontsource/rubik/400.css',
    '@fontsource/rubik/500.css',
    '@fontsource/rubik/700.css',
    '@fontsource/rubik/400-italic.css',
    '@fontsource/noto-sans-sc/400.css',
    '@fontsource/noto-sans-sc/500.css',
    '@fontsource/noto-sans-sc/700.css',
    '@fontsource/pacifico/400.css',
    '~/assets/css/tailwind.css',
  ],

  components: [{ path: '~/components/ui', pathPrefix: false }, '~/components'],

  runtimeConfig: {
    public: {
      VERSION: pkg.version,
      mapbox: {
        accessToken: '',
      },
      app: {
        title: 'PinPoint',
        slogan: '',
        author: '',
        avatarUrl: '',
      },
      map: {
        provider: 'maplibre' as 'mapbox' | 'maplibre',
        mapbox: {
          style: ''
        },
        maplibre: {
          token: '',
          style: '',
        }
      },
      analytics: {
        matomo: {
          enabled: false,
          url: '',
          siteId: '',
        },
      } satisfies AnalyticsConfig,
      oauth: {
        github: {
          enabled: false,
        },
      },
    },
    mapbox: {
      accessToken: '',
    },
    nominatim: {
      baseUrl: 'https://nominatim.openstreetmap.org',
    },
    STORAGE_PROVIDER: 's3' satisfies 's3' | 'local' | 'openlist',
    provider: {
      s3: {
        endpoint: '',
        bucket: '',
        region: 'auto',
        accessKeyId: '',
        secretAccessKey: '',
        prefix: '',
        cdnUrl: '',
        forcePathStyle: false,
      },
      local: {
        localPath: './data/storage',
        baseUrl: '/storage',
        prefix: 'photos/',
      },
      openlist: {
        baseUrl: '',
        rootPath: '',
        token: '',
        endpoints: {
          upload: '/api/fs/put',
          download: '',
          list: '',
          delete: '/api/fs/remove',
          meta: '/api/fs/get',
        },
        pathField: 'path',
        cdnUrl: '',
      } as {
        baseUrl: string;
        rootPath: string;
        token: string;
        endpoints: {
          upload: string;
          download: string;
          list: string;
          delete: string;
          meta: string;
        };
        pathField: string;
        cdnUrl: string;
      },
    },
    upload: {
      mime: {
        whitelistEnabled: true,
        whitelist:
          'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/heic,image/heif,video/quicktime,video/mp4',
      },
      duplicateCheck: {
        enabled: true,
        mode: 'skip' as 'warn' | 'block' | 'skip',
      },
    },
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || 'pinpoint_default_local_dev_password_must_be_long_enough',
      maxAge: 60 * 60 * 24 * 7,
      cookie: {
        sameSite: 'lax',
        secure: false, // Force secure to false by default to support IP access
      }
    },
    allowInsecureCookie: true,
  },

  nitro: {
    // Cloudflare Pages 部署时通过 CF_PAGES 环境变量自动选择 preset
    preset: process.env.CF_PAGES ? 'cloudflare_pages' : (process.env.NITRO_PRESET || 'node_server'),
    experimental: {
      websocket: true,
      tasks: true,
    },
    // Cloudflare 专属配置：仅在 CF_PAGES 构建时生效
    ...(process.env.CF_PAGES
      ? {
          // 开启 nodejs_compat 兼容标志，使 Workers 支持 node:crypto 等内置模块
          cloudflare: {
            nodeCompat: true,
          },
          // Rollup 虚拟 stub：平台专属原生模块，无法在 Workers 中打包
          rollupConfig: {
            plugins: [
              {
                name: 'stub-node-native-for-cloudflare',
                resolveId(id: string) {
                  const stubPatterns = [
                    // 图像处理（sharp 原生模块）
                    'sharp',
                    '@img/sharp-wasm32',
                    '@img/sharp-libvips',
                    // 系统信息（不适用于 Cloudflare Workers）
                    'systeminformation',
                    'osx-temperature-sensor',
                    // SQLite（CF 使用 D1 替代）
                    'better-sqlite3',
                    // 服务端 FFmpeg（CF 不支持原生二进制）
                    'fluent-ffmpeg',
                    'ffprobe-static',
                    '@ffmpeg-installer/ffmpeg',
                    '@ffmpeg-installer/linux-x64',
                    // HEIC 解码（含 WASM）
                    'heic-to',
                    // OG Image 渲染（WASM，即使模块已禁用也防止间接引入）
                    '@resvg/resvg-js',
                    'resvg-js',
                    'yoga-wasm-web',
                    // macOS 原生模块
                    'fsevents',
                  ]
                  if (
                    stubPatterns.some(
                      (p) => id === p || id.startsWith(p + '/') || id.startsWith(p + '\\')
                    )
                  ) {
                    return `\0cf-stub:${id}`
                  }
                },
                load(id: string) {
                  if (id.startsWith('\0cf-stub:')) {
                    return `
                      const stub = new Proxy({}, {
                        get: (_, key) => {
                          if (key === '__esModule') return true;
                          if (key === 'default') return stub;
                          return function() { return stub; };
                        }
                      });
                      export default stub;
                      export const versions = {};
                      export const Sharp = function() {};
                    `
                  }
                },
              },
            ],
          },
        }
      : {}),
  },

  vite: {
    plugins: [tailwindcss() as any],
    optimizeDeps: {
      include: [
        'zod',
        'dayjs',
        'dayjs/plugin/updateLocale',
        'dayjs/locale/zh-cn',
        'dayjs/locale/zh-hk',
        'dayjs/locale/zh-tw',
        'dayjs/locale/en',
        'dayjs/plugin/relativeTime',
        'dayjs/plugin/utc',
        'dayjs/plugin/timezone',
        'dayjs/plugin/duration',
        'dayjs/plugin/localizedFormat',
        'dayjs/plugin/isBetween',
        '@yeger/vue-masonry-wall',
        'motion-v',
        'swiper/vue',
        'swiper/modules',
        'tailwind-merge',
        'thumbhash',
        'mapbox-gl',
        'maplibre-gl',
        '@indoorequal/vue-maplibre-gl',
        'file-type',
        'reka-ui',
        'es-toolkit',
        'tippy.js',
      ],
    },
    ssr: {
      noExternal: ['@indoorequal/vue-maplibre-gl'],
    },
    css: {
      devSourcemap: true,
    },
    build: {
      sourcemap: false,
      commonjsOptions: {
        include: [/maplibre-gl/, /node_modules/],
        transformMixedEsModules: true,
      },
    },
  },

  gtag: {
    enabled: process.env.NODE_ENV === 'production',
  },

  colorMode: {
    // preference: process.env.NUXT_PUBLIC_COLOR_MODE_PREFERENCE || 'dark',
    storageKey: 'cframe-color-mode',
  },

  icon: {
    clientBundle: {
      scan: true,
    },
  },

  ogImage: {
    fonts: ['Rubik:400', 'Rubik:700', 'Noto+Sans+SC:400', 'Noto+Sans+SC:700'],
  },

  fonts: {
    // Disable Google Fonts provider to avoid connection timeouts in China
    providers: {
      google: false,
      googleicons: false,
      bunny: false, // Disable bunny fonts as well
      fontsource: false,
    },
    // Prevent build failure on font download error
    experimental: {
      processCSSVariables: false,
    },
    defaults: {
      weights: [400, 700],
      styles: ['normal', 'italic'],
    }
  },

  dayjs: {
    locales: ['zh-cn', 'zh-hk', 'en'],
    plugins: [
      'relativeTime',
      'utc',
      'timezone',
      'duration',
      'localizedFormat',
      'isBetween',
    ],
    defaultTimezone: 'Asia/Shanghai',
  },

  i18n: {
    experimental: {
      localeDetector: 'localeDetector.ts',
    },
    detectBrowserLanguage: {
      fallbackLocale: 'en',
      useCookie: false,
      cookieKey: 'chronoframe-locale',
    },
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      {
        code: 'zh-Hans',
        name: '简体中文',
        file: 'zh-Hans.json',
        language: 'zh',
      },
      {
        code: 'zh-Hant-TW',
        name: '繁体中文(台湾)',
        file: 'zh-Hant-TW.json',
        language: 'zh-TW',
      },
      {
        code: 'zh-Hant-HK',
        name: '繁体中文(香港)',
        file: 'zh-Hant-HK.json',
        language: 'zh-HK',
      },
      { code: 'en', name: 'English', file: 'en.json', language: 'en' },
      { code: 'ja', name: '日本語', file: 'ja.json', language: 'ja' },
    ],
  },
})
