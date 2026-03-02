import type { IconMap, SocialLink, Site } from '@/types'

export const SITE: Site = {
  title: 'random-talk',
  description: 'Gwen 的隨筆與筆記 — 使用 Astro 打造的個人部落格。',
  // 建議更新為你的 GitHub Pages 網址
  href: 'https://gwen0227.github.io/random-talk/', 
  author: 'Gwen', // 更新為你的名字
  locale: 'en-US',
  featuredPostCount: 2,
  postsPerPage: 3,
}

export const NAV_LINKS: SocialLink[] = [
  {
    href: '/random-talk/blog/',
    label: 'blog',
  },
  // 已移除 authors 連結
  {
    href: '/random-talk/about/',
    label: 'about',
  },
]

export const SOCIAL_LINKS: SocialLink[] = [
  {
    href: 'https://github.com/gwen0227', // 更新為你的 GitHub
    label: 'GitHub',
  },
  // 如果沒有 Twitter，建議移除或註釋掉
  /* {
    href: 'https://twitter.com/your-id',
    label: 'Twitter',
  }, */
  {
    href: 'mailto:your-email@example.com', // 更新為你的 Email
    label: 'Email',
  },
  {
    href: '/random-talk/rss.xml', // 確保 RSS 也有專案路徑
    label: 'RSS',
  },
]

export const ICON_MAP: IconMap = {
  Website: 'lucide:globe',
  GitHub: 'lucide:github',
  LinkedIn: 'lucide:linkedin',
  Twitter: 'lucide:twitter',
  Email: 'lucide:mail',
  RSS: 'lucide:rss',
}