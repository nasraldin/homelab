import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Homelab',
  description:
    'Learn Platform Engineering by building a real homelab — Proxmox, GitOps, Kubernetes, and operations',
  base: '/homelab/',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  srcExclude: ['labs/**'],

  head: [
    ['meta', { name: 'author', content: 'Nasr Aldin' }],
  ],

  themeConfig: {
    siteTitle: 'Homelab',
    logo: undefined,
    nav: [
      { text: 'Start here', link: '/current-state' },
      { text: 'Architecture', link: '/architecture/target-topology' },
      { text: 'Roadmap', link: '/roadmap/' },
      {
        text: 'Community labs',
        items: [
          { text: 'Overview', link: '/community-labs' },
          { text: 'Docker Lab', link: 'https://nasraldin.github.io/docker-lab/' },
          { text: 'Camunda Lab', link: 'https://nasraldin.github.io/camunda-lab/' },
        ],
      },
      {
        text: 'GitHub',
        link: 'https://github.com/nasraldin/homelab',
      },
    ],

    sidebar: {
      '/': [
        {
          text: 'Start here',
          collapsed: false,
          items: [
            { text: 'Home', link: '/' },
            { text: 'Current state', link: '/current-state' },
            { text: 'Build story', link: '/build-story' },
            { text: 'Platform tooling', link: '/platform-tooling' },
            { text: 'Using placeholders', link: '/conventions/placeholders' },
          ],
        },
        {
          text: 'Roadmap',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/roadmap/' },
            { text: 'Foundation sequence', link: '/roadmap/foundation-sequence' },
            { text: 'Phase details', link: '/roadmap/phases' },
          ],
        },
        {
          text: 'Installation',
          collapsed: true,
          items: [
            { text: 'Index', link: '/installation/' },
            { text: 'Journey', link: '/installation/journey' },
            { text: 'Next steps', link: '/installation/next-steps' },
            { text: 'Issues tracker', link: '/installation/issues-tracker' },
            { text: 'Verified state', link: '/installation/verified-state' },
          ],
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Hardware & storage', link: '/architecture/hardware-and-storage' },
            { text: 'Proxmox storage layout', link: '/architecture/proxmox-storage-layout' },
            { text: 'Service placement', link: '/architecture/service-placement' },
            { text: 'Target topology', link: '/architecture/target-topology' },
            { text: 'Network, DNS & ingress', link: '/architecture/network-dns-ingress' },
            { text: 'Automation layers', link: '/architecture/automation-layers' },
          ],
        },
        {
          text: 'Kubernetes',
          collapsed: true,
          items: [
            { text: 'Hub', link: '/kubernetes/' },
            { text: 'kubeadm architecture', link: '/kubernetes/kubeadm-architecture' },
            { text: 'GitOps bootstrap', link: '/kubernetes/gitops-bootstrap' },
            { text: 'Mac Lima Docker', link: '/kubernetes/development/mac-lima-docker' },
          ],
        },
        {
          text: 'Platform',
          collapsed: true,
          items: [
            { text: 'Hub', link: '/platform/' },
            { text: 'Harbor registry', link: '/platform/harbor-registry' },
            { text: 'ITSM & automation', link: '/platform/itsm-and-automation' },
          ],
        },
        {
          text: 'Security',
          collapsed: true,
          items: [
            { text: 'Hub', link: '/security/' },
            { text: 'Supply chain & policies', link: '/security/supply-chain-and-policies' },
            { text: 'Wazuh', link: '/security/wazuh' },
          ],
        },
        {
          text: 'Operations',
          collapsed: true,
          items: [
            { text: 'Hub', link: '/operations/' },
            { text: 'Proxmox updates', link: '/operations/proxmox-updates' },
            { text: 'Backups', link: '/operations/backups' },
            { text: 'Backup platform', link: '/operations/backup-platform' },
          ],
        },
        {
          text: 'Reference',
          collapsed: true,
          items: [
            { text: 'Guest OS strategy', link: '/guest-os/' },
            { text: 'Decision log', link: '/decisions/log' },
            { text: 'Status legend', link: '/conventions/status-legend' },
            { text: 'Legacy plan', link: '/homelab-plan' },
          ],
        },
        {
          text: 'Community labs',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/community-labs' },
            { text: 'Docker Lab (external)', link: 'https://nasraldin.github.io/docker-lab/' },
            { text: 'Camunda Lab (external)', link: 'https://nasraldin.github.io/camunda-lab/' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nasraldin/homelab' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/nasraldin/homelab/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Educational Platform Engineering homelab guide',
      copyright: 'Copyright © 2026 Nasr Aldin',
    },

    outline: {
      level: [2, 3],
    },
  },
})
