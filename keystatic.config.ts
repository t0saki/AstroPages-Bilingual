// @ts-check
/// <reference types="astro/client" />
import { config, fields, collection } from '@keystatic/core';

export default config({
  storage:
    process.env.NODE_ENV === 'production' || import.meta.env?.PROD
      ? {
          kind: 'github',
          repo: 'mhwangdex/AstroPages-Bilingual',
        }
      : {
          kind: 'local',
        },
  collections: {
    posts_zh: collection({
      label: '中文博客',
      slugField: 'title',
      path: 'src/data/blog/zh/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: '标题' } }),
        pubDatetime: fields.date({ label: '发布时间' }),
        description: fields.text({ label: '摘要', multiline: true }),
        draft: fields.checkbox({ label: '草稿', defaultValue: false }),
        featured: fields.checkbox({ label: '推荐文章', defaultValue: false }),
        tags: fields.array(
          fields.text({ label: '标签' }),
          { 
            label: '标签',
            itemLabel: props => props.value
          }
        ),
        content: fields.markdoc({ 
          label: '正文',
          extension: 'md'
        }),
      },
    }),
    posts_en: collection({
      label: 'English Posts',
      slugField: 'title',
      path: 'src/data/blog/en/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        pubDatetime: fields.date({ label: 'Publish Date' }),
        description: fields.text({ label: 'Description', multiline: true }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        featured: fields.checkbox({ label: 'Featured', defaultValue: false }),
        tags: fields.array(
          fields.text({ label: 'Tags' }),
          { 
            label: 'Tags',
            itemLabel: props => props.value
          }
        ),
        content: fields.markdoc({ 
          label: 'Content',
          extension: 'md'
        }),
      },
    }),
  },
});
