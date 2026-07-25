import { defineConfig } from 'vitepress'

// 站点部署在自定义域名 https://nettact.org/(GitHub Pages,CNAME 见 public/CNAME),
// 因此 base 固定为 '/'。若改回 <org>.github.io/<repo> 项目页,需改成 '/docs/'。
export default defineConfig({
  lang: 'zh-CN',
  title: 'NetTact',
  description: 'NetTact 用户文档 —— 家庭与中小企业网络监控:一键部署、Server 配置、Agent 配置',
  base: '/',
  cleanUrls: true,
  lastUpdated: true,

  // README.md 是仓库自述文件(开发/构建说明),不进站点
  srcExclude: ['README.md'],

  sitemap: {
    hostname: 'https://nettact.org'
  },

  themeConfig: {
    nav: [
      { text: '部署', link: '/deploy' },
      { text: 'Server 配置', link: '/server-config' },
      { text: 'Agent 配置', link: '/agent-config' },
      { text: '隐私政策', link: '/privacy' }
    ],

    sidebar: [
      {
        text: '指南',
        items: [
          { text: '一键部署', link: '/deploy' },
          { text: 'Server 配置(nettact-lite)', link: '/server-config' },
          { text: 'Agent 配置(nettact-agent)', link: '/agent-config' }
        ]
      },
      {
        text: '政策',
        items: [
          { text: '隐私政策', link: '/privacy' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nettact/docs' }
    ],

    editLink: {
      pattern: 'https://github.com/nettact/docs/edit/main/:path',
      text: '在 GitHub 上编辑此页'
    },

    search: {
      provider: 'local',
      options: {
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
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新' },
    darkModeSwitchLabel: '外观',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '返回顶部',

    footer: {
      message: '配置清单以各二进制 --help 输出为单一事实来源',
      copyright: '© NetTact'
    }
  }
})
