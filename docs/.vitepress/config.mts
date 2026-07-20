import { defineConfig } from 'vitepress'

const websiteIcon = {
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
}

export default defineConfig({
  title: 'Nasr Aldin Homelab',
  titleTemplate: ':title · Nasr Aldin Homelab',
  description:
    'Platform Engineering homelab by Nasr Aldin — Proxmox, GitOps, Kubernetes, and day-2 operations on real hardware.',
  base: '/homelab/',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  srcExclude: ['labs/**'],

  head: [
    ['meta', { name: 'author', content: 'Nasr Aldin' }],
    ['meta', { property: 'og:title', content: 'Nasr Aldin Homelab' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Platform Engineering on real hardware — notes from Nasr Aldin.',
      },
    ],
    ['meta', { property: 'og:url', content: 'https://nasraldin.github.io/homelab/' }],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://nasraldin.github.io/homelab/homelab-hero.webp',
      },
    ],
    ['link', { rel: 'me', href: 'https://nasraldin.com' }],
  ],

  themeConfig: {
    siteTitle: 'Nasr Aldin Homelab',
    nav: [
      { text: 'MacBook', link: '/macbook/' },
      { text: 'Current state', link: '/current-state' },
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
    ],

    sidebar: {
      '/': [
        {
          text: 'Start here',
          collapsed: false,
          items: [
            { text: 'Home', link: '/' },
            { text: 'MacBook workstation', link: '/macbook/' },
            { text: 'Build story', link: '/build-story' },
            { text: 'Current state', link: '/current-state' },
            { text: 'Platform tooling', link: '/platform-tooling' },
            { text: 'Using placeholders', link: '/conventions/placeholders' },
          ],
        },
        {
          text: 'MacBook',
          collapsed: true,
          items: [{ text: 'Workstation overview', link: '/macbook/' }],
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
            { text: 'Docker Lab', link: 'https://nasraldin.github.io/docker-lab/' },
            { text: 'Camunda Lab', link: 'https://nasraldin.github.io/camunda-lab/' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nasraldin/homelab', ariaLabel: 'GitHub' },
      {
        icon: websiteIcon,
        link: 'https://nasraldin.com',
        ariaLabel: 'Nasr Aldin website',
      },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/nasraldin/homelab/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message:
        'Working notes from <a href="https://nasraldin.com">Nasr Aldin</a> — Platform Engineering on real hardware.',
      copyright:
        'Copyright © 2026 <a href="https://nasraldin.com">Nasr Aldin</a>',
    },

    outline: {
      level: [2, 3],
    },
  },
})
