import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { BUSINESS, SERVICES } from "../../shared/site";
import {
  POST_CATEGORIES,
  categoryLabel,
  formatPostDate,
  type PostSummary,
} from "../../shared/content";
import {
  ArrowLink,
  Breadcrumbs,
  ChecklistBand,
  Eyebrow,
  QuoteBand,
  SiteLayout,
  usePage,
} from "./Layout";

function serviceLabel(slug: string | null) {
  return SERVICES.find(service => service.slug === slug)?.label ?? null;
}

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="post-card">
      <a className="post-card-image" href={`/blog/${post.slug}`} tabIndex={-1}>
        {post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? ""}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="post-card-placeholder" aria-hidden="true">
            S/S
          </span>
        )}
      </a>
      <div className="post-card-body">
        <span className="post-card-category">
          {categoryLabel(post.category)}
          {post.areaName ? ` · ${post.areaName}` : ""}
        </span>
        <h3>
          <a href={`/blog/${post.slug}`}>{post.title}</a>
        </h3>
        <p>{post.excerpt}</p>
        <time dateTime={post.publishedAt ?? undefined}>
          {formatPostDate(post.publishedAt)}
        </time>
      </div>
    </article>
  );
}

export function PostStrip({
  posts,
  title,
  mark = "05",
  eyebrow = "From the job list",
}: {
  posts: PostSummary[] | undefined;
  title: string;
  mark?: string;
  eyebrow?: string;
}) {
  if (!posts || posts.length === 0) return null;
  return (
    <section className="post-strip">
      <div className="wrap">
        <div className="section-heading">
          <div>
            <Eyebrow mark={mark}>{eyebrow}</Eyebrow>
            <h2>{title}</h2>
          </div>
          <ArrowLink href="/blog">All tips & project notes</ArrowLink>
        </div>
        <div className="post-grid">
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function BlogIndexPage() {
  const { data } = usePage();
  const posts = data.posts ?? [];
  const [category, setCategory] = useState<string>("all");
  const shown =
    category === "all"
      ? posts
      : posts.filter(post => post.category === category);
  return (
    <SiteLayout>
      <main id="main" className="inner-page">
        <section className="page-hero page-hero-short">
          <div className="wrap page-hero-inner">
            <Breadcrumbs current="Tips & project notes" />
            <div className="page-kicker">
              <span>WINNIPEG HOME CARE</span>
              <span>NOTES & ADVICE</span>
            </div>
            <h1>
              Notes from
              <br />
              <em>the job list.</em>
            </h1>
            <p className="page-lede">
              Seasonal checklists, practical home-care tips and notes on
              projects around Winnipeg from Seasonal Solutions.
            </p>
          </div>
        </section>
        <section className="blog-index">
          <div className="wrap">
            {posts.length > 0 && (
              <div
                className="chip-row"
                role="group"
                aria-label="Filter by topic"
              >
                {[{ value: "all", label: "All" }, ...POST_CATEGORIES].map(
                  item => (
                    <button
                      key={item.value}
                      type="button"
                      className={`chip ${category === item.value ? "chip-active" : ""}`}
                      aria-pressed={category === item.value}
                      onClick={() => setCategory(item.value)}
                    >
                      {item.label}
                    </button>
                  )
                )}
              </div>
            )}
            {shown.length > 0 ? (
              <div className="post-grid">
                {shown.map(post => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="blog-empty">
                <h2>
                  {posts.length === 0
                    ? "The first articles are on the way."
                    : "Nothing in this topic yet."}
                </h2>
                <p>
                  In the meantime, browse the services or tell us about the work
                  on your list.
                </p>
                <ArrowLink href="/services/handyman">
                  Explore services
                </ArrowLink>
              </div>
            )}
          </div>
        </section>
        <QuoteBand
          title="Have a job on your own list?"
          text="Describe the work and request a free quote for your Winnipeg property."
        />
      </main>
    </SiteLayout>
  );
}

function isSafeImage(src: string | undefined) {
  return Boolean(
    src && (src.startsWith("/manus-storage/") || src.startsWith("https://"))
  );
}

export function BlogPostPage() {
  const { data } = usePage();
  const post = data.post!;
  const service = serviceLabel(post.serviceSlug);
  const quoteHref = post.serviceSlug
    ? `/contact?service=${post.serviceSlug}`
    : "/contact";
  return (
    <SiteLayout>
      <main id="main" className="inner-page">
        <article className="article">
          <header className="article-header">
            <div className="wrap article-header-inner">
              <Breadcrumbs
                current={post.title}
                trail={[{ href: "/blog", label: "Tips & project notes" }]}
              />
              <span className="post-card-category">
                {categoryLabel(post.category)}
              </span>
              <h1>{post.title}</h1>
              <p className="page-lede">{post.excerpt}</p>
              <div className="article-meta">
                <span>
                  <CalendarDays size={15} />
                  <time dateTime={post.publishedAt ?? undefined}>
                    {formatPostDate(post.publishedAt)}
                  </time>
                </span>
                {post.areaName && (
                  <span>
                    <MapPin size={15} /> {post.areaName}
                  </span>
                )}
                {service && post.serviceSlug && (
                  <a href={`/services/${post.serviceSlug}`}>{service}</a>
                )}
              </div>
            </div>
          </header>
          {post.coverImageUrl && (
            <figure className="wrap article-cover">
              <img
                src={post.coverImageUrl}
                alt={post.coverImageAlt ?? ""}
                decoding="async"
              />
            </figure>
          )}
          <div className="wrap article-layout">
            <div className="article-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h2>{children}</h2>,
                  img: ({ src, alt }) =>
                    isSafeImage(typeof src === "string" ? src : undefined) ? (
                      <img
                        src={src as string}
                        alt={alt ?? ""}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null,
                  a: ({ href, children }) => {
                    const external = Boolean(href && /^https?:\/\//.test(href));
                    return (
                      <a
                        href={href}
                        {...(external
                          ? { rel: "noopener noreferrer", target: "_blank" }
                          : {})}
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {post.body}
              </ReactMarkdown>
            </div>
            <aside className="article-aside">
              <div className="detail-note">
                <span className="detail-note-mark">S/S</span>
                <b>
                  {service
                    ? `Need help with ${service.toLowerCase()}?`
                    : "Need a hand?"}
                </b>
                <p>
                  Tell Seasonal Solutions about the work and your area in
                  Winnipeg or a nearby community.
                </p>
                <a className="button button-primary" href={quoteHref}>
                  Request a free quote <ArrowUpRight size={16} />
                </a>
                <a href={`tel:${BUSINESS.phone}`}>{BUSINESS.phoneDisplay}</a>
              </div>
            </aside>
          </div>
        </article>
        <ChecklistBand />
        <PostStrip
          posts={data.related}
          title="More from the job list"
          mark="→"
          eyebrow="Keep reading"
        />
        <QuoteBand
          title="Ready to get it done?"
          text="A clear description helps us understand your request and prepare the next step."
          href={quoteHref}
        />
      </main>
    </SiteLayout>
  );
}
