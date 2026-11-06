/**
 * HANDOFF: SINGLE SOURCE OF TRUTH for business facts: contact details, services, areas, page titles/descriptions, redirects.
 * Edit facts here only. Never invent credentials, reviews, addresses or service areas (HANDOFF.md section 5).
 * SITE_ORIGIN below is hardcoded and not live yet (NEXT-TASKS T1). client/public/manus-routes.json duplicates titles.
 */
export const SITE_ORIGIN = "https://www.seasonalsolutions.online";
export const BUSINESS = {
  name: "Seasonal Solutions",
  phoneDisplay: "(204) 990-3247",
  phone: "+12049903247",
  email: "coled204@hotmail.com",
  city: "Winnipeg",
  region: "Manitoba",
  country: "Canada",
} as const;

export type Service = {
  slug: string;
  label: string;
  short: string;
  title: string;
  summary: string;
  intro: string;
  paragraphs: string[];
  includes: string[];
  quotePrompt: string;
};

export const SERVICES: Service[] = [
  {
    slug: "handyman",
    label: "Handyman services",
    short: "General repairs, installations and home maintenance.",
    title: "Winnipeg Handyman Services",
    summary:
      "Practical help with household repairs, installations and maintenance across Winnipeg.",
    intro:
      "Make progress on the home repairs and small property jobs that have been waiting on your list.",
    paragraphs: [
      "Seasonal Solutions provides general handyman services for Winnipeg homeowners. Tell us what needs attention, where the work is, and any details that could affect the job. That gives us a useful starting point to confirm whether the request is a fit and prepare a clear quote.",
      "Every home and repair is different. We agree on the work to be done before a project is booked. If a request falls outside the agreed scope or requires a licensed trade, that can be clarified before work proceeds.",
      "Whether you have one task or a few items to discuss, use the quote form to describe the work. Photos can be discussed by email after the initial request; do not send payment details through the website.",
    ],
    includes: [
      "General home repairs",
      "Household installations",
      "Property maintenance tasks",
    ],
    quotePrompt:
      "Describe the repair, installation or maintenance task you need help with.",
  },
  {
    slug: "landscaping",
    label: "Landscaping & lawn care",
    short: "Landscape design, installation, maintenance and lawn care.",
    title: "Winnipeg Landscaping & Lawn Care",
    summary:
      "Landscape planning, installation and ongoing care for properties in Winnipeg and nearby communities.",
    intro:
      "Make your outdoor space more useful and cared for, from a new landscape plan to ongoing property maintenance.",
    paragraphs: [
      "Seasonal Solutions offers landscaping, lawn-care and outdoor property services in Winnipeg. The existing service range includes landscape design, installation and maintenance. Share what you want to change or maintain, and include the property's general area when requesting a quote.",
      "Outdoor work depends on the property, the requested scope and the season. A quote conversation is the place to confirm what is practical, what is included, and how the work should be approached before anything is scheduled.",
      "For a larger landscape change or a focused maintenance request, describe the outcome you have in mind. A clear project description helps determine the right next step without assuming that every property needs the same solution.",
    ],
    includes: [
      "Landscape design",
      "Landscape installation",
      "Landscape maintenance and lawn care",
    ],
    quotePrompt:
      "Tell us about the outdoor space, the work you have in mind and your general area.",
  },
  {
    slug: "painting",
    label: "Painting",
    short: "Interior and exterior painting for home refreshes and projects.",
    title: "Interior & Exterior Painting in Winnipeg",
    summary:
      "Plan an interior or exterior painting project with a Winnipeg home-services team.",
    intro:
      "Refresh a room or plan an exterior paint project with a scope that fits your home and priorities.",
    paragraphs: [
      "Seasonal Solutions provides interior and exterior painting services in Winnipeg. A useful quote request describes the surfaces, approximate project size, current condition and the finish you are looking for.",
      "Preparation and materials can affect the work involved. The project details are discussed before a quote is finalized so the proposed scope reflects the property rather than an assumed one-size-fits-all price.",
      "If painting is part of a wider refresh, mention any related repair or renovation needs in the same request. Seasonal Solutions also offers handyman, landscaping and home-renovation services, so the team can discuss the related scope together.",
    ],
    includes: [
      "Interior painting",
      "Exterior painting",
      "Painting as part of a wider home project",
    ],
    quotePrompt:
      "Share the area to be painted, the surface condition and the finish you are considering.",
  },
  {
    slug: "renovation",
    label: "Home renovations",
    short: "Kitchen, bathroom and basement renovation projects.",
    title: "Home Renovations in Winnipeg",
    summary:
      "Discuss kitchen, bathroom and basement renovation ideas with a Winnipeg home-services team.",
    intro:
      "Turn a renovation idea into a clear scope of work, starting with the space and the changes that matter most to you.",
    paragraphs: [
      "Seasonal Solutions lists kitchen, bathroom and basement renovations among its home services. Renovation requests vary considerably, so the first conversation should outline the room, the work you are considering and your priorities for the finished space.",
      "A written quote should reflect an agreed scope rather than an assumed design or schedule. Share the information you have, including whether the project connects to other repair or painting work, and the team can discuss the appropriate next step.",
      "For a major or regulated part of a renovation, confirm the required scope and qualifications before booking. The website does not claim that every trade or permit requirement is included in a renovation request.",
    ],
    includes: [
      "Kitchen renovation discussions",
      "Bathroom renovation discussions",
      "Basement renovation discussions",
    ],
    quotePrompt:
      "Tell us which room you are planning to change and what you hope to accomplish.",
  },
  {
    slug: "seasonal",
    label: "Seasonal maintenance",
    short: "Property upkeep planned around your seasonal to-do list.",
    title: "Seasonal Home Maintenance in Winnipeg",
    summary:
      "Plan seasonal home and property maintenance with a local Winnipeg service provider.",
    intro:
      "Keep a changing home-maintenance list moving with help for the work that fits the season and your property.",
    paragraphs: [
      "Seasonal Solutions brings handyman, landscaping and painting services together with seasonal maintenance for Winnipeg properties. Instead of guessing which package applies, describe the jobs you need done and the timing you have in mind.",
      "Manitoba weather changes the conditions for outdoor work through the year. Availability and suitable timing depend on the specific task and season, so confirm the details as part of the quote conversation.",
      "Seasonal maintenance can also connect to other work: an outdoor update, a repair list or a painting project. Mention related items together so the requested scope can be reviewed in context.",
    ],
    includes: [
      "Seasonal property-maintenance requests",
      "Related handyman work",
      "Outdoor and landscape maintenance requests",
    ],
    quotePrompt:
      "List the seasonal tasks and timing you would like to discuss.",
  },
];

export const WINNIPEG_NEIGHBOURHOODS = [
  "River Heights",
  "St. Vital",
  "Transcona",
  "St. Boniface",
  "Fort Garry",
  "St. James",
  "Charleswood",
  "Downtown Winnipeg",
] as const;

export const NEARBY_COMMUNITIES = [
  "Headingley",
  "East St. Paul",
  "West St. Paul",
  "Oak Bluff",
  "Stonewall",
  "Selkirk",
  "Oakbank",
  "Lorette",
] as const;

export type PageMeta = {
  title: string;
  description: string;
  keywords: string[];
  canonicalPath: string;
  noindex?: boolean;
  ogType?: "website" | "article";
};

const meta: Record<string, PageMeta> = {
  "/": {
    title: "Winnipeg Handyman & Home Services | Seasonal Solutions",
    description:
      "Need a Winnipeg handyman? Seasonal Solutions offers home repairs, landscaping, painting, renovations and seasonal maintenance. Request a free quote.",
    keywords: [
      "Winnipeg handyman",
      "handyman services Winnipeg",
      "Winnipeg home repairs",
      "Winnipeg landscaping",
      "Winnipeg home maintenance",
    ],
    canonicalPath: "/",
  },
  "/services/handyman": {
    title: "Handyman Services Winnipeg | Seasonal Solutions",
    description:
      "Get help with general home repairs, installations and maintenance in Winnipeg. Describe your job and request a free quote from Seasonal Solutions.",
    keywords: [
      "handyman Winnipeg",
      "Winnipeg handyman services",
      "home repair Winnipeg",
      "household installation Winnipeg",
      "property maintenance Winnipeg",
    ],
    canonicalPath: "/services/handyman",
  },
  "/services/landscaping": {
    title: "Winnipeg Landscaping & Lawn Care | Seasonal Solutions",
    description:
      "Explore landscaping, lawn care, design, installation and maintenance in Winnipeg. Tell Seasonal Solutions about your outdoor project and request a quote.",
    keywords: [
      "Winnipeg landscaping",
      "landscaping Winnipeg MB",
      "Winnipeg lawn care",
      "landscape maintenance Winnipeg",
      "landscape installation Winnipeg",
    ],
    canonicalPath: "/services/landscaping",
  },
  "/services/painting": {
    title: "Winnipeg Interior & Exterior Painting | Seasonal Solutions",
    description:
      "Plan an interior or exterior painting project in Winnipeg. Share the surfaces and scope with Seasonal Solutions and request a free quote.",
    keywords: [
      "Winnipeg painting services",
      "interior painting Winnipeg",
      "exterior painting Winnipeg",
      "house painting Winnipeg",
      "Winnipeg home painters",
    ],
    canonicalPath: "/services/painting",
  },
  "/services/renovation": {
    title: "Home Renovations Winnipeg | Seasonal Solutions",
    description:
      "Discuss kitchen, bathroom or basement renovations in Winnipeg. Start with your space, priorities and project details, then request a quote.",
    keywords: [
      "Winnipeg home renovations",
      "kitchen renovation Winnipeg",
      "bathroom renovation Winnipeg",
      "basement renovation Winnipeg",
      "home improvement Winnipeg",
    ],
    canonicalPath: "/services/renovation",
  },
  "/services/seasonal": {
    title: "Seasonal Home Maintenance Winnipeg | Seasonal Solutions",
    description:
      "Organize seasonal home and property maintenance in Winnipeg. Share your task list and timing with Seasonal Solutions to discuss a quote.",
    keywords: [
      "seasonal maintenance Winnipeg",
      "Winnipeg home maintenance",
      "seasonal property care Winnipeg",
      "Winnipeg handyman",
      "outdoor maintenance Winnipeg",
    ],
    canonicalPath: "/services/seasonal",
  },
  "/service-areas": {
    title: "Winnipeg Service Areas | Seasonal Solutions",
    description:
      "Seasonal Solutions serves Winnipeg neighbourhoods and nearby communities with handyman, landscaping, painting, renovation and seasonal services.",
    keywords: [
      "Winnipeg service areas",
      "handyman near me Winnipeg",
      "Winnipeg neighbourhood handyman",
      "Winnipeg home services",
      "property care near Winnipeg",
    ],
    canonicalPath: "/service-areas",
  },
  "/about": {
    title: "About Seasonal Solutions | Winnipeg Home Services",
    description:
      "Learn about Seasonal Solutions' home-service approach in Winnipeg, including handyman work, landscaping, painting, renovations and seasonal maintenance.",
    keywords: [
      "Seasonal Solutions Winnipeg",
      "Winnipeg home services",
      "local handyman Winnipeg",
      "Winnipeg property maintenance",
      "home improvement Winnipeg",
    ],
    canonicalPath: "/about",
  },
  "/our-work": {
    title: "Our Home-Service Approach | Seasonal Solutions Winnipeg",
    description:
      "See how Seasonal Solutions approaches home-service requests: clarify the project, agree on scope and request a quote for your Winnipeg property.",
    keywords: [
      "Seasonal Solutions services",
      "Winnipeg handyman projects",
      "Winnipeg home repair quote",
      "home maintenance Winnipeg",
      "Winnipeg landscaping services",
    ],
    canonicalPath: "/our-work",
  },
  "/contact": {
    title: "Contact a Winnipeg Handyman | Seasonal Solutions",
    description:
      "Contact Seasonal Solutions in Winnipeg by phone or email, or request a free quote for handyman, landscaping, painting, renovation or seasonal work.",
    keywords: [
      "contact Winnipeg handyman",
      "Seasonal Solutions contact",
      "Winnipeg handyman quote",
      "home services Winnipeg contact",
      "Winnipeg home repair estimate",
    ],
    canonicalPath: "/contact",
  },
  "/blog": {
    title: "Winnipeg Home Tips & Project Notes | Seasonal Solutions",
    description:
      "Seasonal home-care checklists, practical repair and yard tips, and project notes for Winnipeg homeowners from Seasonal Solutions.",
    keywords: [
      "Winnipeg home maintenance tips",
      "Winnipeg seasonal checklist",
      "Winnipeg handyman tips",
      "Winnipeg yard care",
      "home repair advice Manitoba",
    ],
    canonicalPath: "/blog",
  },
  "/privacy": {
    title: "Privacy Policy | Seasonal Solutions",
    description:
      "How Seasonal Solutions uses quote requests, customer service history, campaign attribution and optional email consent.",
    keywords: [
      "Seasonal Solutions privacy",
      "quote form privacy",
      "Winnipeg home services privacy",
      "contact information",
      "privacy policy",
    ],
    canonicalPath: "/privacy",
  },
  "/terms": {
    title: "Website Terms | Seasonal Solutions",
    description:
      "Website terms for Seasonal Solutions service information and quote requests in Winnipeg.",
    keywords: [
      "Seasonal Solutions terms",
      "Winnipeg service quote terms",
      "website terms",
      "home-service inquiry",
      "Winnipeg handyman",
    ],
    canonicalPath: "/terms",
  },
  "/admin": {
    title: "Owner Dashboard | Seasonal Solutions",
    description: "Private business dashboard for Seasonal Solutions.",
    keywords: [],
    canonicalPath: "/admin",
    noindex: true,
  },
  "/admin/content": {
    title: "Content Studio | Seasonal Solutions",
    description: "Private content publishing area for Seasonal Solutions.",
    keywords: [],
    canonicalPath: "/admin/content",
    noindex: true,
  },
  "/admin/payments": {
    title: "Online Payments | Seasonal Solutions",
    description: "Private online payment requests for Seasonal Solutions.",
    keywords: [],
    canonicalPath: "/admin/payments",
    noindex: true,
  },
  "/admin/integrations": {
    title: "Integrations | Seasonal Solutions",
    description:
      "Private Stripe and QuickBooks settings for Seasonal Solutions.",
    keywords: [],
    canonicalPath: "/admin/integrations",
    noindex: true,
  },
  "/admin/leads": {
    title: "Private Lead Inbox | Seasonal Solutions",
    description: "Private lead-management area for Seasonal Solutions.",
    keywords: [],
    canonicalPath: "/admin/leads",
    noindex: true,
  },
  "/admin/customers": {
    title: "Private Customer CRM | Seasonal Solutions",
    description:
      "Private customer, service-history and value-management area for Seasonal Solutions.",
    keywords: [],
    canonicalPath: "/admin/customers",
    noindex: true,
  },
  "/admin/follow-ups": {
    title: "Private Follow-Up Tasks | Seasonal Solutions",
    description: "Private follow-up task list for Seasonal Solutions.",
    keywords: [],
    canonicalPath: "/admin/follow-ups",
    noindex: true,
  },
};

export const INDEXABLE_PATHS = Object.entries(meta)
  .filter(([path, page]) => !page.noindex && page.canonicalPath === path)
  .map(([path]) => path);
export const ALL_PAGE_PATHS = [...Object.keys(meta), "/404"];
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/gallery": "/our-work",
  "/testimonials": "/about#our-approach",
  "/request-quote": "/contact",
};

export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/"))
    return pathname.slice(0, -1);
  return pathname || "/";
}

export function getPageMeta(pathname: string): PageMeta | undefined {
  return meta[normalizePath(pathname)];
}

export function getServiceByPath(pathname: string): Service | undefined {
  const match = normalizePath(pathname).match(/^\/services\/([^/]+)$/);
  return match
    ? SERVICES.find(service => service.slug === match[1])
    : undefined;
}

export function isKnownPage(pathname: string): boolean {
  const path = normalizePath(pathname);
  return Boolean(meta[path] || path === "/404");
}

/** Private dashboard routes are served as client-rendered, noindex shells. */
export function isAdminPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/admin" || path.startsWith("/admin/");
}
