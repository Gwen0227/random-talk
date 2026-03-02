import { getCollection, render, type CollectionEntry } from 'astro:content'
import { readingTime, calculateWordCountFromHtml } from '@/lib/utils'

// === 1. 型別定義 ===
export type TOCHeading = {
  slug: string
  text: string
  depth: number
  isSubpostTitle?: boolean
}

export type TOCSection = {
  type: 'parent' | 'subpost'
  title: string
  headings: TOCHeading[]
  subpostId?: string
}

// === 2. 基礎資料獲取 ===
export async function getAllPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog')
  return posts
    .filter((post) => !post.data.draft && !isSubpost(post.id))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

export async function getAllPostsAndSubposts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog')
  return posts
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

export async function getPostById(postId: string): Promise<CollectionEntry<'blog'> | null> {
  const allPosts = await getAllPostsAndSubposts()
  return allPosts.find((post) => post.id === postId) || null
}

export async function getRecentPosts(count: number): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getAllPosts()
  return posts.slice(0, count)
}

export async function getAllProjects(): Promise<CollectionEntry<'projects'>[]> {
  const projects = await getCollection('projects')
  return projects.sort((a, b) => {
    const dateA = a.data.startDate?.getTime() || 0
    const dateB = b.data.startDate?.getTime() || 0
    return dateB - dateA
  })
}

// === 3. 標籤與分類 ===
export async function getAllTags(): Promise<Map<string, number>> {
  const posts = await getAllPosts()
  const tagMap = new Map<string, number>()
  posts.forEach((post) => {
    post.data.tags?.forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
    })
  })
  return tagMap
}

export async function getSortedTags(): Promise<{ tag: string; count: number }[]> {
  const tagCounts = await getAllTags()
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag))
}

export async function getPostsByTag(tag: string): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getAllPosts()
  return posts.filter((post) => post.data.tags?.includes(tag))
}

// === 4. 文章導航與子文章邏輯 ===
export function isSubpost(postId: string): boolean {
  return postId.includes('/')
}

export function getParentId(subpostId: string): string {
  return subpostId.split('/')[0]
}

export async function getParentPost(subpostId: string): Promise<CollectionEntry<'blog'> | null> {
  if (!isSubpost(subpostId)) return null
  return await getPostById(getParentId(subpostId))
}

export async function getSubpostsForParent(parentId: string): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog')
  return posts
    .filter((post) => !post.data.draft && isSubpost(post.id) && getParentId(post.id) === parentId)
    .sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf())
}

export async function getSubpostCount(parentId: string): Promise<number> {
  const subposts = await getSubpostsForParent(parentId)
  return subposts.length
}

export async function hasSubposts(postId: string): Promise<boolean> {
  const count = await getSubpostCount(postId)
  return count > 0
}

export async function getAdjacentPosts(currentId: string) {
  const allPosts = await getAllPosts()
  if (isSubpost(currentId)) {
    const parentId = getParentId(currentId)
    const parent = allPosts.find((p) => p.id === parentId) || null
    const subposts = await getSubpostsForParent(parentId)
    const idx = subposts.findIndex((p) => p.id === currentId)
    return {
      newer: idx < subposts.length - 1 ? subposts[idx + 1] : null,
      older: idx > 0 ? subposts[idx - 1] : null,
      parent
    }
  }
  const parentPosts = allPosts.filter((p) => !isSubpost(p.id))
  const idx = parentPosts.findIndex((p) => p.id === currentId)
  return {
    newer: idx > 0 ? parentPosts[idx - 1] : null,
    older: idx < parentPosts.length - 1 ? parentPosts[idx + 1] : null,
    parent: null
  }
}

// === 5. 閱讀時間計算 ===
export async function getPostReadingTime(postId: string): Promise<string> {
  const post = await getPostById(postId)
  return post ? readingTime(calculateWordCountFromHtml(post.body)) : readingTime(0)
}

export async function getCombinedReadingTime(postId: string): Promise<string> {
  const post = await getPostById(postId)
  if (!post) return readingTime(0)
  let words = calculateWordCountFromHtml(post.body)
  if (!isSubpost(postId)) {
    const subs = await getSubpostsForParent(postId)
    subs.forEach(s => { words += calculateWordCountFromHtml(s.body) })
  }
  return readingTime(words)
}

// === 6. 目錄結構 (TOC) ===
export async function getTOCSections(postId: string): Promise<TOCSection[]> {
  const post = await getPostById(postId)
  if (!post) return []

  const parentId = isSubpost(postId) ? getParentId(postId) : postId
  const parentPost = await getPostById(parentId)
  if (!parentPost) return []

  const sections: TOCSection[] = []
  const { headings: parentHeadings } = await render(parentPost)
  
  if (parentHeadings.length > 0) {
    sections.push({ 
      type: 'parent', 
      title: 'Overview', 
      headings: parentHeadings.map(h => ({ ...h, isSubpostTitle: false })) 
    })
  }

  const subposts = await getSubpostsForParent(parentId)
  for (const sub of subposts) {
    const { headings } = await render(sub)
    if (headings.length > 0) {
      sections.push({ 
        type: 'subpost', 
        title: sub.data.title, 
        headings: headings.map((h, i) => ({ ...h, isSubpostTitle: i === 0 })),
        subpostId: sub.id 
      })
    }
  }
  return sections
}

// === 7. 其他輔助與相容性 ===
export function groupPostsByYear(posts: CollectionEntry<'blog'>[]): Record<string, CollectionEntry<'blog'>[]> {
  const groups: Record<string, CollectionEntry<'blog'>[]> = {}
  posts.forEach((post) => {
    const year = post.data.date.getFullYear().toString()
    if (!groups[year]) groups[year] = []
    groups[year].push(post)
  })
  return groups
}

export async function parseAuthors() {
  return []
}