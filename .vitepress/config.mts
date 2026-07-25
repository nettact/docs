import { defineConfig } from 'vitepress'

// 站点部署在自定义域名 https://nettact.org/(GitHub Pages,CNAME 见 public/CNAME),
// 因此 base 固定为 '/'。若改回 <org>.github.io/<repo> 项目页,需改成 '/docs/'。
//
// i18n:两种语言地位对等,各自住在自己的目录里 —— 中文 zh/ → /zh/,英文 en/ → /en/,
// 没有 root locale。根路径 / 由 index.md 提供一个 meta-refresh 落地页转到 /zh/。
// 每篇文档必须在两边都存在且路径一一对应(/zh/deploy ↔ /en/deploy):语言切换器
// 是按路径前缀改写的,少一篇就会切到 404。
// 例外:隐私政策本身就是中英合一的单页,en/privacy.md 用 @include 复用 zh/privacy.md,
// 不做第二份翻译。
export default defineConfig({
  title: 'NetTact',
  base: '/',
  cleanUrls: true,
  lastUpdated: true,

  // README.md 是仓库自述文件(开发/构建说明),不进站点
  srcExclude: ['README.md'],

  sitemap: {
    hostname: 'https://nettact.org',
    // 根路径是跳转页(noindex),不进 sitemap
    transformItems: (items) => items.filter((item) => item.url !== '')
  },

  locales: {
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      description: 'NetTact 用户文档 —— 家庭与中小企业网络监控:一键部署、Server 配置、Agent 配置',

      themeConfig: {
        nav: [
          { text: '部署', link: '/zh/deploy' },
          { text: 'Server 配置', link: '/zh/server-config' },
          { text: 'Agent 配置', link: '/zh/agent-config' },
          { text: '隐私政策', link: '/zh/privacy' }
        ],

        sidebar: [
          {
            text: '指南',
            items: [
              { text: '一键部署', link: '/zh/deploy' },
              { text: 'Server 配置(nettact-lite)', link: '/zh/server-config' },
              { text: 'Agent 配置(nettact-agent)', link: '/zh/agent-config' }
            ]
          },
          {
            text: '政策',
            items: [
              { text: '隐私政策', link: '/zh/privacy' }
            ]
          }
        ],

        editLink: {
          pattern: 'https://github.com/nettact/docs/edit/main/:path',
          text: '在 GitHub 上编辑此页'
        },

        outline: { level: [2, 3], label: '本页目录' },
        docFooter: { prev: '上一篇', next: '下一篇' },
        lastUpdated: { text: '最后更新' },
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色主题',
        darkModeSwitchTitle: '切换到深色主题',
        sidebarMenuLabel: '目录',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '切换语言',

        footer: {
          message: '配置清单以各二进制 --help 输出为单一事实来源',
          copyright: '© NetTact'
        }
      }
    },

    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      description: 'NetTact user documentation — network monitoring for homes and small businesses: one-command deploy, server configuration, agent configuration',

      themeConfig: {
        nav: [
          { text: 'Deploy', link: '/en/deploy' },
          { text: 'Server config', link: '/en/server-config' },
          { text: 'Agent config', link: '/en/agent-config' },
          { text: 'Privacy', link: '/en/privacy' }
        ],

        sidebar: [
          {
            text: 'Guide',
            items: [
              { text: 'One-command deploy', link: '/en/deploy' },
              { text: 'Server configuration (nettact-lite)', link: '/en/server-config' },
              { text: 'Agent configuration (nettact-agent)', link: '/en/agent-config' }
            ]
          },
          {
            text: 'Policies',
            items: [
              { text: 'Privacy policy', link: '/en/privacy' }
            ]
          }
        ],

        editLink: {
          pattern: 'https://github.com/nettact/docs/edit/main/:path',
          text: 'Edit this page on GitHub'
        },

        outline: { level: [2, 3] },

        footer: {
          message: 'The single source of truth for configuration is each binary’s --help output',
          copyright: '© NetTact'
        }
      }
    }
  },

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/nettact/docs' }
    ],

    search: {
      provider: 'local',
      options: {
        // 英文 locale 用 VitePress 自带的英文默认文案,只覆盖中文
        locales: {
          zh: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '未找到相关结果',
                resetButtonTitle: '清除查询条件',
                displayDetails: '显示详细列表',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭'
                }
              }
            }
          }
        }
      }
    }
  }
})
