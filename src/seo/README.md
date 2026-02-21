# SEO Module

This folder keeps SEO logic modular and separate from feature modules.

- `metadata.js`
  - Central definitions for page titles, descriptions, and structured data.
- `useSeoMeta.js`
  - React hook to apply SEO tags (`title`, meta tags, canonical, JSON-LD) at runtime.

The hook is used from `/src/App.jsx` so each module tab can update page metadata consistently.

