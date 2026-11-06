import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowUpRight, ChevronRight, Mail, Menu, Phone, X } from "lucide-react";
import { BUSINESS, SERVICES } from "../../shared/site";
import type { PageData } from "../../shared/content";
import { Brand } from "./Brand";

export type PageContextValue = { path: string; data: PageData };

export const PageContext = createContext<PageContextValue>({
  path: "/",
  data: {},
});

export function usePage(): PageContextValue {
  return useContext(PageContext);
}

const NAV_LINKS = [
  { href: "/services/handyman", label: "Handyman" },
  { href: "/services/landscaping", label: "Landscaping" },
  { href: "/services/painting", label: "Painting" },
  { href: "/services/renovation", label: "Renovations" },
  { href: "/service-areas", label: "Areas" },
  { href: "/blog", label: "Tips" },
];

function isCurrent(path: string, href: string) {
  return path === href || (href === "/blog" && path.startsWith("/blog/"));
}

function Header() {
  const { path } = usePage();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className="topline">
        <div className="wrap topline-inner">
          <span>
            <span className="status-dot" /> Serving Winnipeg & nearby
            communities
          </span>
          <a href={`tel:${BUSINESS.phone}`}>
            <Phone size={14} /> {BUSINESS.phoneDisplay}
          </a>
        </div>
      </div>
      <header className="site-header">
        <div className="wrap header-inner">
          <Brand />
          <button
            ref={toggleRef}
            className="menu-toggle"
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="main-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            id="main-navigation"
            className={`main-nav ${open ? "nav-open" : ""}`}
            aria-label="Main navigation"
          >
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={close}
                aria-current={isCurrent(path, link.href) ? "page" : undefined}
              >
                {link.label}
              </a>
            ))}
            <a
              className="nav-quote"
              href="/contact"
              onClick={close}
              aria-current={path === "/contact" ? "page" : undefined}
            >
              Get a quote <ArrowUpRight size={15} />
            </a>
          </nav>
        </div>
      </header>
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-main">
        <div className="footer-brand-block">
          <Brand light />
          <p>
            Practical property care for Winnipeg homes, from the small fix to
            the next season's list.
          </p>
          <a className="footer-phone" href={`tel:${BUSINESS.phone}`}>
            <Phone size={16} /> {BUSINESS.phoneDisplay}
          </a>
        </div>
        <div className="footer-column">
          <h2>Services</h2>
          {SERVICES.map(service => (
            <a key={service.slug} href={`/services/${service.slug}`}>
              {service.label}
            </a>
          ))}
        </div>
        <div className="footer-column">
          <h2>Explore</h2>
          <a href="/about">About</a>
          <a href="/our-work">Our approach</a>
          <a href="/blog">Home tips & project notes</a>
          <a href="/service-areas">Service areas</a>
          <a href="/contact">Request a quote</a>
        </div>
        <div className="footer-column">
          <h2>Get in touch</h2>
          <a href={`mailto:${BUSINESS.email}`}>
            <Mail size={15} /> {BUSINESS.email}
          </a>
          <a href="/contact">
            Tell us about your project <ArrowUpRight size={14} />
          </a>
          <span>Winnipeg, Manitoba</span>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© {new Date().getFullYear()} Seasonal Solutions</span>
        <div>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/admin" rel="nofollow">
            Owner login
          </a>
        </div>
        <span>Serving Winnipeg & area</span>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}

export function Eyebrow({
  children,
  mark = "01",
}: {
  children: ReactNode;
  mark?: string;
}) {
  return (
    <div className="eyebrow">
      <span className="eyebrow-mark">{mark}</span>
      <span>{children}</span>
    </div>
  );
}

export function ArrowLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a className={`arrow-link ${className}`} href={href}>
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}

export function Breadcrumbs({
  current,
  trail = [],
}: {
  current: string;
  trail?: Array<{ href: string; label: string }>;
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a>
      {trail.map(item => (
        <React.Fragment key={item.href}>
          <ChevronRight size={13} />
          <a href={item.href}>{item.label}</a>
        </React.Fragment>
      ))}
      <ChevronRight size={13} />
      <span aria-current="page">{current}</span>
    </nav>
  );
}

export function QuoteBand({
  title = "A project on your mind?",
  text = "A few details are all we need to start the conversation.",
  href = "/contact",
}: {
  title?: string;
  text?: string;
  href?: string;
}) {
  return (
    <section className="quote-band">
      <div className="wrap quote-band-inner">
        <div>
          <Eyebrow mark="→">A clear next step</Eyebrow>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <a className="button button-light" href={href}>
          Request a free quote <ArrowUpRight size={17} />
        </a>
      </div>
    </section>
  );
}
