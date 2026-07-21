import { defineConfig } from 'vitepress'

const websiteIcon = {
  svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Website</title><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
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
  srcExclude: ['labs/**'],

  head: [
    ['meta', { name: 'author', content: 'Nasr Aldin' }],
    ['meta', { property: 'og:title', content: 'Nasr Aldin Homelab' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Platform Engineering on real hardware — notes from Nasr Aldin.',
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
      { text: 'Where things stand', link: '/current-state' },
      { text: 'Topology', link: '/architecture/target-topology' },
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
            { text: 'Homelab story', link: '/build-story' },
            { text: 'Where things stand', link: '/current-state' },
            { text: 'Tool ownership', link: '/platform-tooling' },
            { text: 'Placeholders & secrets', link: '/conventions/placeholders' },
          ],
        },
        {
          text: 'MacBook',
          collapsed: true,
          items: [{ text: 'Workstation setup', link: '/macbook/' }],
        },
        {
          text: 'Roadmap',
          collapsed: true,
          items: [
            { text: 'Roadmap overview', link: '/roadmap/' },
            { text: 'Foundation first', link: '/roadmap/foundation-sequence' },
            { text: 'All phases', link: '/roadmap/phases' },
          ],
        },
        {
          text: 'Install Proxmox',
          collapsed: true,
          items: [
            { text: 'Phase 0 journal', link: '/installation/' },
            { text: 'Install walkthrough', link: '/installation/journey' },
            { text: 'Close Phase 0', link: '/installation/next-steps' },
            { text: 'Debug install issues', link: '/installation/issues-tracker' },
            { text: 'Verify the node', link: '/installation/verified-state' },
          ],
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Drives & slots', link: '/architecture/hardware-and-storage' },
            { text: 'Proxmox storage', link: '/architecture/proxmox-storage-layout' },
            { text: 'GPU / IOMMU passthrough', link: '/architecture/gpu-passthrough' },
            { text: 'VM vs k8s vs Docker', link: '/architecture/service-placement' },
            { text: 'Full topology map', link: '/architecture/target-topology' },
            { text: 'Network & DNS', link: '/architecture/network-dns-ingress' },
            { text: 'Automation layers', link: '/architecture/automation-layers' },
          ],
        },
        {
          text: 'Kubernetes',
          collapsed: true,
          items: [
            { text: 'Build k8s like a pro', link: '/kubernetes/' },
            { text: 'kubeadm HA design', link: '/kubernetes/kubeadm-architecture' },
            { text: 'GitOps bootstrap', link: '/kubernetes/gitops-bootstrap' },
            { text: 'Docker on Mac (Lima)', link: '/kubernetes/development/mac-lima-docker' },
          ],
        },
        {
          text: 'Platform',
          collapsed: true,
          items: [
            { text: 'Shared services', link: '/platform/' },
            { text: 'Harbor registry', link: '/platform/harbor-registry' },
            { text: 'Zammad & n8n', link: '/platform/itsm-and-automation' },
          ],
        },
        {
          text: 'Security',
          collapsed: true,
          items: [
            { text: 'Security overview', link: '/security/' },
            { text: 'Cosign & Kyverno', link: '/security/supply-chain-and-policies' },
            { text: 'Wazuh SIEM', link: '/security/wazuh' },
          ],
        },
        {
          text: 'Operations',
          collapsed: true,
          items: [
            { text: 'Ops overview', link: '/operations/' },
            { text: 'Deploy & rebuild order', link: '/operations/deploy-and-rebuild' },
            { text: 'DNS DHCP cutover', link: '/operations/dns-dhcp-cutover' },
            { text: 'Safe Proxmox upgrades', link: '/operations/proxmox-updates' },
            { text: 'VM backup stages', link: '/operations/backups' },
            { text: 'PBS / Velero / MinIO', link: '/operations/backup-platform' },
          ],
        },
        {
          text: 'Reference',
          collapsed: true,
          items: [
            { text: 'Guest OS choices', link: '/guest-os/' },
            { text: 'QEMU Guest Agent', link: '/guest-os/#qemu-guest-agent' },
            { text: 'Decision log', link: '/decisions/log' },
            { text: 'Status symbols', link: '/conventions/status-legend' },
            { text: 'Old plan (moved)', link: '/homelab-plan' },
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
      message: 'Working notes from <a href="https://nasraldin.com">Nasr Aldin</a>',
      copyright: 'Copyright © 2026 <a href="https://nasraldin.com">Nasr Aldin</a>',
    },

    outline: {
      level: [2, 3],
    },
  },
})
