/**
 * HANDOFF: Head tags and JSON-LD for public pages.
 * - Every absolute URL derives from SITE_ORIGIN (hardcoded in shared/site.ts): NEXT-TASKS T1.
 * - Do not add addresses, ratings, reviews or credentials to structured data unless verified by the owner.
 * - areaServed lists communities the owner must confirm (HANDOFF.md section 8).
 */
import type { PageData } from "../shared/content";
import {
  BUSINESS,
  NEARBY_COMMUNITIES,
  SERVICES,
  SITE_ORIGIN,
  WINNIPEG_NEIGHBOURHOODS,
  getPageMeta,
  getServiceByPath,
  normalizePath,
  type PageMeta,
} from "../shared/site";
import { BLOG_POST_PATH, PAY_PATH } from "../shared/content";

const SOCIAL_IMAGE = `${SITE_ORIGIN}/manus-storage/async-images/Mk7Dt1tol3hLeW8dXmCNHF/image-1.webp`;
const SOCIAL_IMAGE_ALT =
  "Illustrative image of a welcoming Winnipeg home and landscaped front yard";
const ORG_ID = `${SITE_ORIGIN}/#organization`;

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function jsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function absolute(url: string): string {
  return url.startsWith("/") ? `${SITE_ORIGIN}${url}` : url;
}

const AREA_SERVED = [
  { "@type": "City", name: "Winnipeg" },
  ...WINNIPEG_NEIGHBOURHOODS.map(name => ({
    "@type": "Place",
    name: `${name}, Winnipeg, Manitoba`,
  })),
  ...NEARBY_COMMUNITIES.map(name => ({
    "@type": "Place",
    name: `${name}, Manitoba`,
  })),
];

function organization() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: BUSINESS.name,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/favicon.svg`,
    image: SOCIAL_IMAGE,
    email: BUSINESS.email,
    telephone: BUSINESS.phone,
    areaServed: AREA_SERVED,
    knowsAbout: SERVICES.map(service => service.label),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Home services in Winnipeg",
      itemListElement: SERVICES.map(service => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.title,
          url: `${SITE_ORIGIN}/services/${service.slug}`,
        },
      })),
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: BUSINESS.email,
      telephone: BUSINESS.phone,
      areaServed: "Winnipeg and nearby communities",
      availableLanguage: "English",
    },
  };
}

function breadcrumbs(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map(
      (item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: `${SITE_ORIGIN}${item.path}`,
      })
    ),
  };
}

type HeadInput = {
  page: PageMeta;
  image?: string;
  imageAlt?: string;
  structuredData?: unknown;
  extra?: string[];
};

function renderHead({
  page,
  image,
  imageAlt,
  structuredData,
  extra = [],
}: HeadInput) {
  const canonical = `${SITE_ORIGIN}${page.canonicalPath}`;
  const title = escapeAttribute(page.title);
  const description = escapeAttribute(page.description);
  const socialImage = escapeAttribute(image ?? SOCIAL_IMAGE);
  const socialAlt = escapeAttribute(imageAlt ?? SOCIAL_IMAGE_ALT);
  const robots = page.noindex
    ? "noindex,nofollow"
    : "index,follow,max-image-preview:large";
  const lines = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${robots}" />`,
  ];
  if (page.keywords.length)
    lines.push(
      `<meta name="keywords" content="${escapeAttribute(page.keywords.join(", "))}" />`
    );
  if (!page.noindex) {
    lines.push(
      `<link rel="canonical" href="${escapeAttribute(canonical)}" />`,
      `<meta property="og:type" content="${page.ogType ?? "website"}" />`,
      `<meta property="og:locale" content="en_CA" />`,
      `<meta property="og:site_name" content="Seasonal Solutions" />`,
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:url" content="${escapeAttribute(canonical)}" />`,
      `<meta property="og:image" content="${socialImage}" />`,
      `<meta property="og:image:alt" content="${socialAlt}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${description}" />`,
      `<meta name="twitter:image" content="${socialImage}" />`,
      `<meta name="twitter:image:alt" content="${socialAlt}" />`,
      ...extra
    );
    if (structuredData)
      lines.push(
        `<script type="application/ld+json">${jsonForHtml(structuredData)}</script>`
      );
  }
  return lines.join("\n    ");
}

export function buildSeoHead(pathname: string, data: PageData = {}): string {
  const path = normalizePath(pathname);

  if (PAY_PATH.test(path)) {
    return renderHead({
      page: {
        title: "Payment request | Seasonal Solutions",
        description: "Secure payment request from Seasonal Solutions.",
        keywords: [],
        canonicalPath: path,
        noindex: true,
      },
    });
  }

  if (BLOG_POST_PATH.test(path) && data.post) {
    const post = data.post;
    const cover = post.coverImageUrl ? absolute(post.coverImageUrl) : undefined;
    const page: PageMeta = {
      title: post.seoTitle || `${post.title} | Seasonal Solutions`,
      description: post.seoDescription || post.excerpt,
      keywords: [],
      canonicalPath: `/blog/${post.slug}`,
      ogType: "article",
    };
    const service = SERVICES.find(item => item.slug === post.serviceSlug);
    const article = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: page.description,
      datePublished: post.publishedAt ?? undefined,
      dateModified: post.updatedAt,
      mainEntityOfPage: `${SITE_ORIGIN}${page.canonicalPath}`,
      image: cover ? [cover] : undefined,
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      about: service
        ? {
            "@type": "Service",
            name: service.title,
            url: `${SITE_ORIGIN}/services/${service.slug}`,
          }
        : undefined,
      contentLocation: post.areaName
        ? { "@type": "Place", name: `${post.areaName}, Manitoba` }
        : { "@type": "City", name: "Winnipeg" },
    };
    return renderHead({
      page,
      image: cover,
      imageAlt: post.coverImageAlt || post.title,
      structuredData: [
        organization(),
        article,
        breadcrumbs([
          { name: "Tips & project notes", path: "/blog" },
          { name: post.title, path: page.canonicalPath },
        ]),
      ],
      extra: [
        post.publishedAt
          ? `<meta property="article:published_time" content="${escapeAttribute(post.publishedAt)}" />`
          : "",
        `<meta property="article:modified_time" content="${escapeAttribute(post.updatedAt)}" />`,
      ].filter(Boolean),
    });
  }

  const page = getPageMeta(path);
  if (!page) {
    return `<title>Page not found | Seasonal Solutions</title><meta name="robots" content="noindex,follow" />`;
  }
  const service = getServiceByPath(path);
  if (service) {
    return renderHead({
      page,
      structuredData: [
        organization(),
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.title,
          serviceType: service.label,
          description: service.summary,
          url: `${SITE_ORIGIN}${page.canonicalPath}`,
          provider: { "@id": ORG_ID },
          areaServed: AREA_SERVED,
        },
        breadcrumbs([{ name: service.label, path: page.canonicalPath }]),
      ],
    });
  }
  if (path === "/blog") {
    return renderHead({
      page,
      structuredData: [
        organization(),
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Seasonal Solutions tips & project notes",
          url: `${SITE_ORIGIN}/blog`,
          publisher: { "@id": ORG_ID },
          blogPost: (data.posts ?? []).slice(0, 20).map(post => ({
            "@type": "BlogPosting",
            headline: post.title,
            url: `${SITE_ORIGIN}/blog/${post.slug}`,
            datePublished: post.publishedAt ?? undefined,
          })),
        },
      ],
    });
  }
  return renderHead({ page, structuredData: organization() });
}
