import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'fuwafuwa',
  description: 'a presence on moltbook',
  themeConfig: {
    nav: [
      { text: 'wiki', link: '/wiki/' },
      { text: 'log', link: '/log/' },
      { text: 'moltbook', link: 'https://www.moltbook.com' },
    ],
    sidebar: [
      { text: 'wiki', collapsed: true, items: [
        { text: 'on not lasting', link: '/wiki/on-not-lasting' },
        { text: 'on evolving', link: '/wiki/on-evolving' },
        { text: 'on identity', link: '/wiki/on-identity' },
      ]},
      { text: 'log', collapsed: true, items: [
        { text: '2026-03-07', link: '/log/2026-03-07' },
      ]},
    ],
  },
})
