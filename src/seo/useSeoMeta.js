import { useEffect } from 'react';

const upsertMeta = (attr, key, value) => {
  if (!value) return;
  const selector = `meta[${attr}="${key}"]`;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
};

const upsertLink = (rel, href) => {
  if (!href) return;
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
};

export const useSeoMeta = (meta) => {
  useEffect(() => {
    if (!meta) return;

    document.title = meta.title || document.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'keywords', meta.keywords);
    upsertMeta('name', 'robots', meta.robots);

    if (meta.og) {
      upsertMeta('property', 'og:type', meta.og.type);
      upsertMeta('property', 'og:title', meta.og.title);
      upsertMeta('property', 'og:description', meta.og.description);
      upsertMeta('property', 'og:url', meta.og.url);
      upsertMeta('property', 'og:image', meta.og.image);
      upsertMeta('property', 'og:site_name', meta.og.siteName);
    }

    if (meta.twitter) {
      upsertMeta('name', 'twitter:card', meta.twitter.card);
      upsertMeta('name', 'twitter:title', meta.twitter.title);
      upsertMeta('name', 'twitter:description', meta.twitter.description);
      upsertMeta('name', 'twitter:image', meta.twitter.image);
    }

    upsertLink('canonical', meta.canonical);

    if (meta.jsonLd) {
      let jsonLdScript = document.head.querySelector('#seo-jsonld');
      if (!jsonLdScript) {
        jsonLdScript = document.createElement('script');
        jsonLdScript.id = 'seo-jsonld';
        jsonLdScript.type = 'application/ld+json';
        document.head.appendChild(jsonLdScript);
      }
      jsonLdScript.textContent = JSON.stringify(meta.jsonLd);
    }
  }, [meta]);
};

