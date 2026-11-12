/**
 * HANDOFF: Public pages (home, services, areas, about, our work, contact, legal). Large single file; split it (NEXT-TASKS T8).
 * Page copy must stay specific and truthful; business facts come from shared/site.ts. The hero image is labelled illustrative.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  Compass,
  Hammer,
  Leaf,
  Mail,
  Menu,
  Paintbrush,
  Phone,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  BUSINESS,
  NEARBY_COMMUNITIES,
  SERVICES,
  WINNIPEG_NEIGHBOURHOODS,
  getServiceByPath,
  isKnownPage,
  normalizePath,
  type Service,
} from "../../shared/site";
import { MARKETING_CONSENT_COPY } from "../../shared/crm";
import { BLOG_POST_PATH, PAY_PATH, type PageData } from "../../shared/content";
import {
  ArrowLink,
  Breadcrumbs,
  Eyebrow,
  PageContext,
  QuoteBand,
  SiteLayout,
  usePage,
} from "./Layout";
import { BlogIndexPage, BlogPostPage, PostStrip } from "./BlogPages";
import { LoginPage } from "./LoginPage";
import { PayPage } from "./PayPage";
import { trackPageView } from "./tracking";
import React from "react";

const heroImage = "/images/hero.jpg";
const handymanImage = "/images/handyman.jpg";

const serviceIcons = [Hammer, Leaf, Paintbrush, Sparkles, Compass];

type Props = { path?: string; data?: PageData };

function ServiceCard({ service, index }: { service: Service; index: number }) {
  const Icon = serviceIcons[index] ?? Hammer;
  return (
    <article className="service-card">
      <div className="service-card-media">
        <img
          src={service.image}
          alt={service.imageAlt}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="service-card-top">
        <span className="service-icon">
          <Icon size={21} strokeWidth={1.7} />
        </span>
        <span className="card-index">0{index + 1}</span>
      </div>
      <h3>
        <a href={`/services/${service.slug}`}>{service.label}</a>
      </h3>
      <p>{service.short}</p>
      <a
        className="card-arrow"
        href={`/services/${service.slug}`}
        aria-label={`Explore ${service.label}`}
      >
        <ArrowUpRight size={18} />
      </a>
    </article>
  );
}

function ServicesSection({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`services-section ${compact ? "services-compact" : ""}`}
    >
      <div className="wrap">
        <div className="section-heading">
          <div>
            <Eyebrow mark="02">What we can help with</Eyebrow>
            <h2>One list. A few good ways to get it done.</h2>
          </div>
          <p>
            Home repairs, outdoor work and seasonal upkeep—tell us what is on
            your list and we can discuss the right scope.
          </p>
        </div>
        <div className="service-grid">
          {SERVICES.map((service, index) => (
            <ServiceCard key={service.slug} service={service} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  const [motionOk, setMotionOk] = useState(false);
  useEffect(() => {
    setMotionOk(
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);
  const alt =
    "Seasonal Solutions operator with a snowblower in a snowy Winnipeg driveway at dusk";
  if (motionOk) {
    return (
      <video
        src="/videos/hero-snow.mp4"
        poster={heroImage}
        autoPlay
        muted
        loop
        playsInline
        role="img"
        aria-label={alt}
      />
    );
  }
  return <img src={heroImage} fetchPriority="high" alt={alt} />;
}

function HomePage() {
  const { data } = usePage();
  return (
    <SiteLayout>
      <main id="main">
        <section className="home-hero">
          <div className="wrap home-hero-grid">
            <div className="hero-copy">
              <Eyebrow mark="WINNIPEG · ALL SEASONS">
                Home services, made practical
              </Eyebrow>
              <h1>
                Good work for the <em>home</em> you live in.
              </h1>
              <p className="hero-lede">
                From the handyman list to the yard and the next renovation,
                Seasonal Solutions helps Winnipeg homeowners move property
                projects forward.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="/contact">
                  Tell us what needs doing <ArrowUpRight size={17} />
                </a>
                <a className="text-link" href="/services/handyman">
                  Explore services <ArrowDownRight size={16} />
                </a>
              </div>
              <div className="hero-contact">
                <span>Start with a quick conversation</span>
                <a href={`tel:${BUSINESS.phone}`}>
                  <Phone size={15} /> {BUSINESS.phoneDisplay}
                </a>
              </div>
            </div>
            <figure className="hero-visual">
              <HeroVisual />
              <span className="image-stamp">
                LOCAL
                <br />
                PROPERTY
                <br />
                CARE
              </span>
              <figcaption>
                Illustrative image · Not a completed Seasonal Solutions project
              </figcaption>
            </figure>
          </div>
          <div className="hero-side-note" aria-hidden="true">
            SEASONAL SOLUTIONS — WINNIPEG
          </div>
        </section>
        <div className="wrap proof-strip">
          <span>
            <Check size={15} /> Free quote requests
          </span>
          <span>
            <Check size={15} /> Winnipeg & nearby areas
          </span>
          <span>
            <Check size={15} /> Five connected service categories
          </span>
        </div>
        <ServicesSection />
        <section className="split-story">
          <div className="wrap split-story-inner">
            <div className="story-image">
              <div className="story-image-frame">
                <img
                  src={handymanImage}
                  loading="lazy"
                  decoding="async"
                  alt="Illustrative close-up of careful home repair work"
                />
                <span className="story-image-caption">
                  Illustrative image · Not a completed project
                </span>
              </div>
            </div>
            <div className="story-copy">
              <Eyebrow mark="03">A better way to start</Eyebrow>
              <h2>
                Start with the work.
                <br />
                <em>Not a sales pitch.</em>
              </h2>
              <p>
                Explain the job, the property and what you are hoping to change.
                Seasonal Solutions can review the request and confirm a
                practical scope before work is booked.
              </p>
              <div className="story-points">
                <div>
                  <span>01</span>
                  <p>
                    <b>Tell us the basics</b>
                    <small>
                      Choose a service and add the details that matter.
                    </small>
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <p>
                    <b>Confirm the scope</b>
                    <small>Talk through fit, materials and next steps.</small>
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <p>
                    <b>Get a quote</b>
                    <small>
                      Request a free quote before deciding how to proceed.
                    </small>
                  </p>
                </div>
              </div>
              <ArrowLink href="/about">More about our approach</ArrowLink>
            </div>
          </div>
        </section>
        <section className="area-preview">
          <div className="wrap area-preview-inner">
            <div>
              <Eyebrow mark="04">Where we work</Eyebrow>
              <h2>Winnipeg is home base.</h2>
              <p>
                Serving Winnipeg neighbourhoods and nearby communities. Share
                your area with the project details so we can confirm
                availability for your request.
              </p>
              <ArrowLink href="/service-areas">See the service areas</ArrowLink>
            </div>
            <div className="area-tag-cloud">
              {[
                ...WINNIPEG_NEIGHBOURHOODS.slice(0, 5),
                "& more in Winnipeg",
              ].map(area => (
                <span key={area}>{area}</span>
              ))}
            </div>
          </div>
        </section>
        <PostStrip posts={data.posts} title="Home tips and project notes" />
        <QuoteBand
          title="Let's get your list moving."
          text="Tell us what needs attention, and request a free quote for your Winnipeg home."
        />
      </main>
    </SiteLayout>
  );
}

function ServicePage({ service }: { service: Service }) {
  const { data } = usePage();
  const index = SERVICES.findIndex(item => item.slug === service.slug);
  const related = SERVICES.filter(item => item.slug !== service.slug).slice(
    0,
    3
  );
  return (
    <SiteLayout>
      <main id="main" className="inner-page">
        <section className="page-hero">
          <div className="wrap page-hero-inner">
            <Breadcrumbs current={service.label} />
            <div className="page-kicker">
              <span>WINNIPEG HOME SERVICES</span>
              <span>0{index + 1} / 05</span>
            </div>
            <h1>
              {service.title}
              <span className="period">.</span>
            </h1>
            <p className="page-lede">{service.intro}</p>
            <a
              className="button button-primary"
              href={`/contact?service=${service.slug}`}
            >
              Request a free quote <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
        <div className="wrap">
          <figure className="service-banner">
            <img
              src={service.image}
              alt={service.imageAlt}
              fetchPriority="high"
            />
            <figcaption className="media-caption">
              Illustrative image · Not a completed Seasonal Solutions project
            </figcaption>
          </figure>
        </div>
        <section className="service-detail">
          <div className="wrap detail-grid">
            <aside className="detail-aside">
              <div className="detail-note">
                <span className="detail-note-mark">S/S</span>
                <b>{service.label}</b>
                <p>{service.short}</p>
                <a href={`tel:${BUSINESS.phone}`}>
                  <Phone size={15} /> {BUSINESS.phoneDisplay}
                </a>
              </div>
              <div className="detail-link-group">
                <h2>Also available</h2>
                {related.map(item => (
                  <a key={item.slug} href={`/services/${item.slug}`}>
                    {item.label}
                    <ArrowUpRight size={14} />
                  </a>
                ))}
              </div>
            </aside>
            <article className="detail-content">
              <Eyebrow mark="01">Service overview</Eyebrow>
              <h2>{service.summary}</h2>
              {service.paragraphs.map(paragraph => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <div className="scope-card">
                <div className="scope-card-title">
                  <span>AT A GLANCE</span>
                  <h3>Work to discuss</h3>
                </div>
                <ul>
                  {service.includes.map(item => (
                    <li key={item}>
                      <Check size={15} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {service.slug === "landscaping" && (
                <figure className="detail-media">
                  <video
                    src="/videos/lawn.mp4"
                    poster="/images/service-lawn.jpg"
                    autoPlay
                    muted
                    loop
                    playsInline
                    aria-label="Seasonal Solutions operator mowing a lawn"
                  />
                  <figcaption className="media-caption">
                    Illustrative clip · Lawn care through the season
                  </figcaption>
                </figure>
              )}
              {service.slug === "seasonal" && (
                <div className="season-strip">
                  {[
                    {
                      src: "/images/service-spring.jpg",
                      label: "Spring cleanup",
                      alt: "Seasonal Solutions operator doing a spring yard cleanup",
                    },
                    {
                      src: "/images/service-fall.jpg",
                      label: "Fall cleanup",
                      alt: "Seasonal Solutions operator with a backpack leaf blower in autumn",
                    },
                    {
                      src: "/images/service-eavestrough.jpg",
                      label: "Eavestroughs",
                      alt: "Seasonal Solutions operator cleaning eavestroughs from a ladder",
                    },
                    {
                      src: "/images/service-pressure.jpg",
                      label: "Pressure washing",
                      alt: "Seasonal Solutions operator pressure washing a driveway",
                    },
                  ].map(item => (
                    <figure key={item.label}>
                      <img
                        src={item.src}
                        alt={item.alt}
                        loading="lazy"
                        decoding="async"
                      />
                      <figcaption>{item.label}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
              <section className="detail-local">
                <Eyebrow mark="02">Local service</Eyebrow>
                <h3>{service.label} in Winnipeg, Manitoba</h3>
                <p>
                  Seasonal Solutions serves Winnipeg and surrounding
                  communities. Tell us your neighbourhood or community and the
                  type of property when requesting a quote. Availability and
                  project scope are confirmed for each request.
                </p>
                <ArrowLink href="/service-areas">
                  View all listed service areas
                </ArrowLink>
              </section>
              <div className="detail-cta">
                <p>{service.quotePrompt}</p>
                <a
                  className="button button-primary"
                  href={`/contact?service=${service.slug}`}
                >
                  Start a quote request <ArrowUpRight size={16} />
                </a>
              </div>
            </article>
          </div>
        </section>
        <section className="related-services">
          <div className="wrap">
            <Eyebrow mark="03">More ways we can help</Eyebrow>
            <div className="related-row">
              {related.map(item => (
                <a key={item.slug} href={`/services/${item.slug}`}>
                  <span>{item.label}</span>
                  <ArrowUpRight size={17} />
                </a>
              ))}
            </div>
          </div>
        </section>
        <PostStrip
          posts={data.related}
          title={`${service.label}: tips and project notes`}
          mark="04"
          eyebrow="Related reading"
        />
        <QuoteBand
          title="Let's talk through the project."
          href={`/contact?service=${service.slug}`}
          text="A clear description helps us understand your service request and prepare the next step."
        />
      </main>
    </SiteLayout>
  );
}

function ServiceAreasPage() {
  return (
    <SiteLayout>
      <main id="main" className="inner-page">
        <section className="page-hero">
          <div className="wrap page-hero-inner">
            <Breadcrumbs current="Service areas" />
            <div className="page-kicker">
              <span>WINNIPEG & AREA</span>
              <span>LOCAL COVERAGE</span>
            </div>
            <h1>
              Property care,
              <br />
              <em>around Winnipeg.</em>
            </h1>
            <p className="page-lede">
              Seasonal Solutions lists Winnipeg and these nearby neighbourhoods
              and communities among its service areas. Tell us where the
              property is so we can confirm availability.
            </p>
            <a className="button button-primary" href="/contact">
              Check service availability <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
        <section className="area-detail">
          <div className="wrap area-columns">
            <article>
              <Eyebrow mark="01">Winnipeg neighbourhoods</Eyebrow>
              <h2>Within the city</h2>
              <p>
                Handyman, landscaping, painting, renovation and
                seasonal-maintenance enquiries are welcome from across Winnipeg.
                The work requested and current availability are confirmed with
                each quote.
              </p>
              <div className="area-list">
                {WINNIPEG_NEIGHBOURHOODS.map((area, index) => (
                  <div key={area}>
                    <span>0{index + 1}</span>
                    <b>{area}</b>
                    <ArrowUpRight size={15} />
                  </div>
                ))}
              </div>
            </article>
            <article>
              <Eyebrow mark="02">Nearby communities</Eyebrow>
              <h2>Outside Winnipeg</h2>
              <p>
                Seasonal Solutions also names these surrounding communities.
                Travel distance and the specific service can affect
                availability, so include your community in the quote request.
              </p>
              <div className="area-list">
                {NEARBY_COMMUNITIES.map((area, index) => (
                  <div key={area}>
                    <span>0{index + 1}</span>
                    <b>{area}</b>
                    <ArrowUpRight size={15} />
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
        <section className="area-service-note">
          <div className="wrap area-service-note-inner">
            <div>
              <Eyebrow mark="03">One request, the right details</Eyebrow>
              <h2>What to include in your quote.</h2>
            </div>
            <p>
              Choose the service, share the property's general area, and
              describe the work. If a project includes more than one service,
              mention them together so the requested scope can be discussed in
              context.
            </p>
          </div>
        </section>
        <QuoteBand
          title="Not sure if you're in range?"
          text="Send your community and project details and ask about availability."
        />
      </main>
    </SiteLayout>
  );
}

function AboutPage() {
  return (
    <SiteLayout>
      <main id="main" className="inner-page">
        <section className="page-hero">
          <div className="wrap page-hero-inner">
            <Breadcrumbs current="About" />
            <div className="page-kicker">
              <span>SEASONAL SOLUTIONS</span>
              <span>WINNIPEG, MANITOBA</span>
            </div>
            <h1>
              A practical partner
              <br />
              <em>for property work.</em>
            </h1>
            <p className="page-lede">
              Seasonal Solutions brings handyman services, landscaping,
              painting, renovations and seasonal maintenance together for
              homeowners in Winnipeg and nearby communities.
            </p>
          </div>
        </section>
        <section className="about-body">
          <div className="wrap about-grid">
            <aside>
              <Eyebrow mark="01">Our approach</Eyebrow>
              <figure className="about-portrait">
                <img
                  src="/images/portrait-about.jpg"
                  alt="Portrait of the Seasonal Solutions operator in winter work gear"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="media-caption">
                  Illustrative image
                </figcaption>
              </figure>
              <p className="about-aside-copy">
                Start with a clear description of the work and a useful
                conversation about the scope.
              </p>
            </aside>
            <article id="our-approach">
              <h2>Useful work starts with clear details.</h2>
              <p>
                Homes have ongoing to-do lists. Some projects are focused on
                repairs, others on an outdoor space or a room that needs an
                update. Seasonal Solutions provides a range of property services
                so Winnipeg homeowners can ask about the work they need in one
                place.
              </p>
              <p>
                There is no one-size-fits-all scope. Describe your property, the
                job and your priorities. Before work is booked, the specific
                request, availability and quote need to be confirmed.
              </p>
              <p>
                Share the service you need, where the property is, and the work
                you would like to plan. Current availability and the quote are
                confirmed for each request.
              </p>
              <div className="about-fact">
                <span>01</span>
                <div>
                  <b>Clear scope</b>
                  <p>Discuss what is included before work begins.</p>
                </div>
              </div>
              <div className="about-fact">
                <span>02</span>
                <div>
                  <b>Connected services</b>
                  <p>
                    Handyman, outdoor and home-improvement requests in one
                    conversation.
                  </p>
                </div>
              </div>
              <div className="about-fact">
                <span>03</span>
                <div>
                  <b>Local coverage</b>
                  <p>Winnipeg neighbourhoods and named nearby communities.</p>
                </div>
              </div>
            </article>
          </div>
        </section>
        <ServicesSection compact />
        <QuoteBand
          title="Tell us what you're working on."
          text="Start with a project description, then request a free quote."
        />
      </main>
    </SiteLayout>
  );
}

function BeforeAfter() {
  const [pos, setPos] = useState(50);
  return (
    <div className="ba-block">
      <div className="ba-compare">
        <img
          className="ba-img"
          src="/images/gallery-after.jpg"
          alt="Yard after a cleanup (illustrative)"
          loading="lazy"
          decoding="async"
        />
        <img
          className="ba-img ba-before"
          src="/images/gallery-before.jpg"
          alt="Yard before a cleanup (illustrative)"
          loading="lazy"
          decoding="async"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <span className="ba-tag ba-tag-before">Before</span>
        <span className="ba-tag ba-tag-after">After</span>
        <span className="ba-divider" style={{ left: `${pos}%` }} />
      </div>
      <input
        className="ba-range"
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={event => setPos(Number(event.target.value))}
        aria-label="Slide to compare the before and after images"
      />
    </div>
  );
}

function WorkPage() {
  const { data } = usePage();
  return (
    <SiteLayout>
      <main id="main" className="inner-page">
        <section className="page-hero">
          <div className="wrap page-hero-inner">
            <Breadcrumbs current="Our approach" />
            <div className="page-kicker">
              <span>FROM FIRST NOTE TO CLEAR SCOPE</span>
              <span>WINNIPEG</span>
            </div>
            <h1>
              Work that starts
              <br />
              <em>with a plan.</em>
            </h1>
            <p className="page-lede">
              Every property is different. We start by understanding what needs
              doing, then discuss the scope and quote before the work is booked.
            </p>
          </div>
        </section>
        <section className="work-steps">
          <div className="wrap">
            <Eyebrow mark="01">A straightforward process</Eyebrow>
            <div className="work-step-grid">
              <article>
                <span>01 / SHARE</span>
                <h2>Describe the job</h2>
                <p>
                  Choose a service and tell us about the property, the work and
                  your general location.
                </p>
              </article>
              <article>
                <span>02 / DISCUSS</span>
                <h2>Confirm the scope</h2>
                <p>
                  Review the details, any limits and whether the request fits
                  current service availability.
                </p>
              </article>
              <article>
                <span>03 / QUOTE</span>
                <h2>Decide with clarity</h2>
                <p>
                  Request a free quote and consider the agreed project details
                  before deciding how to proceed.
                </p>
              </article>
            </div>
            <p className="editorial-note">
              Images elsewhere on the site are illustrative, not project photos.
            </p>
          </div>
        </section>
        <section className="work-showcase">
          <div className="wrap showcase-grid">
            <div>
              <Eyebrow mark="02">Before / after</Eyebrow>
              <h2>The difference a cleanup makes.</h2>
              <BeforeAfter />
              <p className="editorial-note">
                Illustrative images — a sample yard cleanup, not a completed
                Seasonal Solutions project.
              </p>
            </div>
            <div className="promo-block">
              <Eyebrow mark="03">In motion</Eyebrow>
              <div className="promo-frame">
                <video
                  src="/videos/promo.mp4"
                  poster="/images/service-fall.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  aria-label="Seasonal Solutions in 15 seconds: snow removal, lawn care and fall cleanup"
                />
              </div>
              <p className="editorial-note">
                Seasonal Solutions in 15 seconds — snow, lawn and fall
                cleanup.
              </p>
            </div>
          </div>
        </section>
        <PostStrip
          posts={data.posts}
          title="Recent project notes"
          mark="04"
          eyebrow="Project notes"
        />
        <QuoteBand
          title="Have a project in mind?"
          text="Tell us what you would like to get done in Winnipeg or a nearby community."
        />
      </main>
    </SiteLayout>
  );
}

type QuoteValues = {
  name: string;
  email: string;
  phone: string;
  service: string;
  area: string;
  projectType: string;
  details: string;
  consent: boolean;
  marketingOptIn: boolean;
  landingPath: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  website: string;
};
const emptyQuote: QuoteValues = {
  name: "",
  email: "",
  phone: "",
  service: "",
  area: "",
  projectType: "residential",
  details: "",
  consent: false,
  marketingOptIn: false,
  landingPath: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  website: "",
};

type SessionAttribution = Pick<
  QuoteValues,
  "landingPath" | "utmSource" | "utmMedium" | "utmCampaign"
>;
const attributionKey = "seasonal-solutions:first-touch:v1";

function getSessionAttribution(): SessionAttribution {
  const params = new URLSearchParams(window.location.search);
  const current: SessionAttribution = {
    landingPath: window.location.pathname.slice(0, 255),
    utmSource: params.get("utm_source")?.slice(0, 120) ?? "",
    utmMedium: params.get("utm_medium")?.slice(0, 120) ?? "",
    utmCampaign: params.get("utm_campaign")?.slice(0, 160) ?? "",
  };
  try {
    const stored = sessionStorage.getItem(attributionKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<SessionAttribution>;
      return {
        landingPath:
          typeof parsed.landingPath === "string" &&
          parsed.landingPath.startsWith("/") &&
          !parsed.landingPath.startsWith("//") &&
          !/[?#\u0000-\u001f]/.test(parsed.landingPath)
            ? parsed.landingPath.slice(0, 255)
            : current.landingPath,
        utmSource:
          typeof parsed.utmSource === "string"
            ? parsed.utmSource.slice(0, 120)
            : current.utmSource,
        utmMedium:
          typeof parsed.utmMedium === "string"
            ? parsed.utmMedium.slice(0, 120)
            : current.utmMedium,
        utmCampaign:
          typeof parsed.utmCampaign === "string"
            ? parsed.utmCampaign.slice(0, 160)
            : current.utmCampaign,
      };
    }
    sessionStorage.setItem(attributionKey, JSON.stringify(current));
  } catch {
    return current;
  }
  return current;
}

function QuoteForm() {
  const [values, setValues] = useState<QuoteValues>(emptyQuote);
  const [state, setState] = useState<{
    kind: "idle" | "sending" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const attribution = getSessionAttribution();
    const requestedService = params.get("service");
    const validService = SERVICES.some(
      service => service.slug === requestedService
    );
    setValues(previous => ({
      ...previous,
      ...(validService ? { service: requestedService! } : {}),
      ...attribution,
    }));
  }, []);
  const set = (key: keyof QuoteValues, value: string | boolean) =>
    setValues(previous => ({ ...previous, [key]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending", message: "Sending your request…" });
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ||
            "We couldn't send your request. Please try again or contact us by phone."
        );
      setValues({
        ...emptyQuote,
        ...getSessionAttribution(),
      });
      setState({
        kind: "success",
        message:
          "Thanks — your quote request has been received. Seasonal Solutions will review the details.",
      });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't send your request. Please try again or contact us by phone.",
      });
    }
  }
  return (
    <form className="quote-form" onSubmit={submit}>
      <div className="form-heading">
        <span>REQUEST FORM</span>
        <h2>Tell us about the work.</h2>
        <p>
          Fields marked with <b>*</b> are required. No payment details are
          needed.
        </p>
      </div>
      <div className="form-grid">
        <label>
          Service needed <b>*</b>
          <select
            required
            name="service"
            value={values.service}
            onChange={event => set("service", event.target.value)}
          >
            <option value="">Select a service</option>
            {SERVICES.map(service => (
              <option key={service.slug} value={service.slug}>
                {service.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Property area <span className="optional">Optional</span>
          <input
            autoComplete="address-level2"
            name="area"
            maxLength={120}
            value={values.area}
            onChange={event => set("area", event.target.value)}
            placeholder="Neighbourhood or community"
          />
        </label>
        <label className="form-wide">
          Project details <b>*</b>
          <textarea
            name="details"
            required
            minLength={10}
            maxLength={5000}
            rows={5}
            value={values.details}
            onChange={event => set("details", event.target.value)}
            placeholder="What needs doing? Add any timing or scope details that may help."
          />
          <span className="field-hint">
            {values.details.length}/5000 characters
          </span>
        </label>
        <p className="form-step form-wide">How should we reach you?</p>
        <label>
          Full name <b>*</b>
          <input
            autoComplete="name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            value={values.name}
            onChange={event => set("name", event.target.value)}
            placeholder="Your name"
          />
        </label>
        <label>
          Email address <b>*</b>
          <input
            autoComplete="email"
            name="email"
            required
            type="email"
            maxLength={320}
            value={values.email}
            onChange={event => set("email", event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          Phone number <span className="optional">Optional</span>
          <input
            autoComplete="tel"
            name="phone"
            type="tel"
            maxLength={40}
            value={values.phone}
            onChange={event => set("phone", event.target.value)}
            placeholder="(204) 555-0123"
          />
        </label>
        <label>
          Property type <span className="optional">Optional</span>
          <select
            name="projectType"
            value={values.projectType}
            onChange={event => set("projectType", event.target.value)}
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
      </div>
      <label className="honeypot" aria-hidden="true">
        Leave this field empty
        <input
          tabIndex={-1}
          autoComplete="off"
          name="website"
          value={values.website}
          onChange={event => set("website", event.target.value)}
        />
      </label>
      <label className="consent-row">
        <input
          type="checkbox"
          required
          checked={values.consent}
          onChange={event => set("consent", event.target.checked)}
        />
        <span>
          I agree to be contacted about this project request. This is not a
          marketing subscription.
        </span>
      </label>
      <label className="consent-row marketing-optin">
        <input
          type="checkbox"
          name="marketingOptIn"
          checked={values.marketingOptIn}
          onChange={event => set("marketingOptIn", event.target.checked)}
        />
        <span>{MARKETING_CONSENT_COPY}</span>
      </label>
      {state.message && (
        <div
          className={`form-message form-${state.kind}`}
          role={state.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </div>
      )}
      <div className="form-submit">
        <button
          className="button button-primary"
          type="submit"
          disabled={state.kind === "sending"}
        >
          {state.kind === "sending" ? "Sending…" : "Send quote request"}{" "}
          <ArrowUpRight size={17} />
        </button>
        <span>
          Or call <a href={`tel:${BUSINESS.phone}`}>{BUSINESS.phoneDisplay}</a>
        </span>
      </div>
      <p className="form-privacy">
        Your details are used to manage this inquiry and customer-service
        history. Optional email marketing is separate and unchecked by default.
        See our <a href="/privacy">privacy notice</a>.
      </p>
    </form>
  );
}

function ContactPage({ quoteOnly = false }: { quoteOnly?: boolean }) {
  return (
    <SiteLayout>
      <main id="main" className="inner-page">
        <section className="page-hero page-hero-short">
          <div className="wrap page-hero-inner">
            <Breadcrumbs current={quoteOnly ? "Request a quote" : "Contact"} />
            <div className="page-kicker">
              <span>START THE CONVERSATION</span>
              <span>WINNIPEG & AREA</span>
            </div>
            <h1>
              Let's talk about
              <br />
              <em>your project.</em>
            </h1>
            <p className="page-lede">
              {quoteOnly
                ? "Share a few details about the work and request a free quote from Seasonal Solutions."
                : "Tell us what needs doing. We'll start with a clear conversation about the scope."}
            </p>
          </div>
        </section>
        <section className="contact-section">
          <div className="wrap contact-grid">
            <aside className="contact-aside">
              <Eyebrow mark="01">Reach Seasonal Solutions</Eyebrow>
              <h2>
                Real details.
                <br />
                <em>Clear next step.</em>
              </h2>
              <p>
                Request a free quote using the form, or contact the business
                directly.
              </p>
              <a className="contact-detail" href={`tel:${BUSINESS.phone}`}>
                <span>
                  <Phone size={18} />
                </span>
                <div>
                  <small>CALL</small>
                  <b>{BUSINESS.phoneDisplay}</b>
                </div>
                <ArrowUpRight size={16} />
              </a>
              <a className="contact-detail" href={`mailto:${BUSINESS.email}`}>
                <span>
                  <Mail size={18} />
                </span>
                <div>
                  <small>EMAIL</small>
                  <b>{BUSINESS.email}</b>
                </div>
                <ArrowUpRight size={16} />
              </a>
              <div className="coverage-card">
                <span className="coverage-icon">
                  <Compass size={18} />
                </span>
                <div>
                  <small>AREA SERVED</small>
                  <b>Winnipeg & nearby communities</b>
                  <a href="/service-areas">
                    See listed areas <ArrowUpRight size={13} />
                  </a>
                </div>
              </div>
              <p className="address-note">
                Share your Winnipeg neighbourhood or nearby community with the
                project details so availability can be confirmed.
              </p>
              <figure className="contact-photo">
                <img
                  src="/images/service-fall.jpg"
                  alt="Seasonal Solutions operator doing a fall yard cleanup with a backpack leaf blower"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </aside>
            <QuoteForm />
          </div>
        </section>
        <QuoteBand
          title="Prefer to talk first?"
          text="Call directly or email the project details to Seasonal Solutions."
        />
      </main>
    </SiteLayout>
  );
}

function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const privacy = type === "privacy";
  return (
    <SiteLayout>
      <main id="main" className="inner-page legal-page">
        <div className="wrap legal-wrap">
          <Breadcrumbs current={privacy ? "Privacy" : "Terms"} />
          <div className="page-kicker">
            <span>SEASONAL SOLUTIONS</span>
            <span>WEBSITE INFORMATION</span>
          </div>
          <h1>
            {privacy ? "Privacy notice" : "Website terms"}
            <span className="period">.</span>
          </h1>
          <p className="legal-intro">
            {privacy
              ? "This notice explains how quote requests, linked customer profiles and service history are used."
              : "These terms apply to the information and quote-request features on the Seasonal Solutions website."}
          </p>
          {privacy ? (
            <>
              <h2>Information you provide</h2>
              <p>
                The quote form asks for your name, email address, service
                needed, project details and, optionally, phone number and
                property area. It also records that you agreed to be contacted
                about that specific request.
              </p>
              <p>
                The first landing-page path, referring-page path and, when
                present, campaign source, medium and campaign labels may be held
                temporarily in browser session storage and stored with a
                request. This helps understand which website activity generated
                an inquiry. Avoid placing names, email addresses or other
                personal information in campaign labels. To limit quote spam,
                the server may temporarily process a network address in memory;
                it is not added to the CRM.
              </p>
              <h2>Customer and service history</h2>
              <p>
                To manage repeat inquiries, the business may link quote requests
                using a normalized email address and assign an internal customer
                ID. Authorized administration may also record service jobs,
                quoted and booked amounts, received payments or refunds, and
                internal follow-up dates and notes. These amount records are not
                payment processing; do not submit payment card or bank details.
              </p>
              <h2>How the details are used</h2>
              <p>
                Submitted details are stored so Seasonal Solutions can review
                and respond to the request, maintain relevant service history
                and manage follow-up. Access to customer and job information is
                restricted to authorized administration.
              </p>
              <h2>Website statistics</h2>
              <p>
                The site counts page views and the general source of a visit
                (for example a search engine, social site or campaign tag) as
                daily totals. These statistics use no cookies, advertising
                trackers or visitor identifiers, and they are not linked to
                quote requests or customer profiles.
              </p>
              <h2>Online payments and accounting</h2>
              <p>
                If Seasonal Solutions sends you a payment link, the payment is
                processed by Stripe on its secure checkout page. Your card
                details go directly to Stripe and are never seen or stored by
                this website; the business keeps the amount, date and payment
                reference with the job record. Customer names, contact details,
                invoices and payments may also be recorded in the business's
                accounting software (QuickBooks Online) for bookkeeping.
              </p>
              <h2>Optional email updates</h2>
              <p>
                The marketing checkbox is optional, separate from the required
                project-contact agreement and unchecked by default. If you
                select it, the business records the consent date and source.
                This website does not send email, text messages or campaigns.
                You may contact the business to withdraw a recorded consent.
              </p>
              <h2>Contact and questions</h2>
              <p>
                For a question about an inquiry you sent, contact Seasonal
                Solutions at{" "}
                <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. The
                business may need to confirm your identity before discussing
                information connected to a request.
              </p>
              <h2>Updates</h2>
              <p>
                This notice may be updated if the website's form or data
                handling changes. Check this page for the current version.
              </p>
            </>
          ) : (
            <>
              <h2>Service information</h2>
              <p>
                Website content describes general service categories and is not
                a binding offer or guarantee that every request can be accepted.
                Availability, the work included, timing, materials and price
                must be confirmed for each project.
              </p>
              <h2>Quote requests</h2>
              <p>
                Submitting the form sends a request for follow-up; it does not
                by itself create a service agreement, reserve a date or
                guarantee an estimate. Provide accurate contact details and a
                clear project description.
              </p>
              <h2>Website use</h2>
              <p>
                Do not use the form to send unlawful content, spam, payment
                information or information about another person without
                permission. Contact Seasonal Solutions if you need to discuss a
                request.
              </p>
              <h2>Questions</h2>
              <p>
                Contact{" "}
                <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> about
                these website terms.
              </p>
            </>
          )}
        </div>
      </main>
    </SiteLayout>
  );
}

function NotFoundPage() {
  return (
    <SiteLayout>
      <main id="main" className="not-found">
        <div className="wrap">
          <span className="not-found-code">404 / NOT FOUND</span>
          <h1>
            That page isn't
            <br />
            <em>on the list.</em>
          </h1>
          <p>
            Try the services page or get in touch about the work you need done.
          </p>
          <a className="button button-primary" href="/">
            Back to home <ArrowRight size={16} />
          </a>
        </div>
      </main>
    </SiteLayout>
  );
}

function AdminPlaceholder() {
  return (
    <main id="main" className="admin-boot">
      <span className="loader-dot" /> Loading the owner dashboard…
    </main>
  );
}

function PublicPage({ pathname }: { pathname: string }) {
  const { data } = usePage();
  if (pathname.startsWith("/admin")) return <AdminPlaceholder />;
  if (pathname === "/login") return <LoginPage />;
  if (BLOG_POST_PATH.test(pathname))
    return data.post ? <BlogPostPage /> : <NotFoundPage />;
  if (PAY_PATH.test(pathname))
    return data.payment ? <PayPage /> : <NotFoundPage />;
  if (!isKnownPage(pathname)) return <NotFoundPage />;
  const service = getServiceByPath(pathname);
  if (service) return <ServicePage service={service} />;
  switch (pathname) {
    case "/":
      return <HomePage />;
    case "/service-areas":
      return <ServiceAreasPage />;
    case "/about":
      return <AboutPage />;
    case "/our-work":
      return <WorkPage />;
    case "/blog":
      return <BlogIndexPage />;
    case "/contact":
      return <ContactPage />;
    case "/privacy":
      return <LegalPage type="privacy" />;
    case "/terms":
      return <LegalPage type="terms" />;
    default:
      return <NotFoundPage />;
  }
}

export default function App({ path, data = {} }: Props = {}) {
  const pathname = normalizePath(
    path ?? (typeof window === "undefined" ? "/" : window.location.pathname)
  );
  useEffect(() => {
    if (pathname.startsWith("/admin") || PAY_PATH.test(pathname)) return;
    getSessionAttribution();
    trackPageView(pathname);
  }, [pathname]);
  return (
    <PageContext.Provider value={{ path: pathname, data }}>
      <PublicPage pathname={pathname} />
    </PageContext.Provider>
  );
}
