/**
 * HANDOFF: SINGLE SOURCE OF TRUTH for business facts: contact details, services, areas, page titles/descriptions, redirects.
 * Edit facts here only. Never invent credentials, reviews, addresses or service areas (HANDOFF.md section 5).
 * SITE_ORIGIN uses the server environment with the existing domain as fallback. client/public/manus-routes.json duplicates titles.
 */
export const SITE_ORIGIN = (
  (typeof process !== "undefined"
    ? process.env.SITE_ORIGIN?.trim()
    : undefined) || "https://www.seasonalsolutions.online"
).replace(/\/+$/, "");
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
  image: string;
  imageAlt: string;
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
    image: "/images/service-handyman.jpg",
    imageAlt:
      "Seasonal Solutions operator in a black T-shirt and navy work pants, tattoo sleeves visible, ready for repair work",
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
    image: "/images/service-lawn.jpg",
    imageAlt:
      "Seasonal Solutions operator mowing a green lawn in summer work gear",
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
    image: "/images/service-painting.jpg",
    imageAlt: "Seasonal Solutions operator painting an interior wall",
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
    image: "/images/service-renovation.jpg",
    imageAlt: "Seasonal Solutions operator at work on a home renovation",
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
    image: "/images/service-snow.jpg",
    imageAlt: "Seasonal Solutions operator clearing snow with a snowblower",
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
  "/checklist": {
    title: "The Winnipeg Seasonal Home Checklist | Seasonal Solutions",
    description:
      "Forty seasonal home jobs for Winnipeg homeowners — spring, summer, fall and winter — free from Seasonal Solutions. Read it online, print it, or get it by email.",
    keywords: [
      "Winnipeg seasonal home checklist",
      "Winnipeg home maintenance checklist",
      "fall cleanup checklist Winnipeg",
      "winter home preparation Manitoba",
      "spring home maintenance Winnipeg",
    ],
    canonicalPath: "/checklist",
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

/**
 * The Winnipeg Seasonal Home Checklist — the site's lead magnet.
 * A complete, genuinely useful list; keeping it current is a content task,
 * not a code change. Seasonal Solutions can do any item on request
 * (the seasonal maintenance service covers the list).
 */
export type ChecklistItem = { title: string; detail: string };
export type ChecklistSeason = {
  season: string;
  timing: string;
  intro: string;
  items: ChecklistItem[];
};

export const CHECKLIST_TITLE = "The Winnipeg Seasonal Home Checklist";

export const CHECKLIST: ChecklistSeason[] = [
  {
    season: "Spring",
    timing: "March to May · as the snow melts",
    intro:
      "Winnipeg winters hide a lot. Spring is when you find out what the freeze did — and when a small fix is still small.",
    items: [
      {
        title: "Test the sump pump",
        detail:
          "Pour a bucket of water into the pit and watch it kick on. Meltwater plus spring rain is when Winnipeg basements flood.",
      },
      {
        title: "Clear the eavestroughs and downspouts",
        detail:
          "Winter leaves them full of ice and grit. Downspouts should carry water at least six feet from the foundation.",
      },
      {
        title: "Walk the foundation",
        detail:
          "Freeze-thaw opens new cracks every year. Mark any you find and watch them through the season.",
      },
      {
        title: "Check the roof from the ground",
        detail:
          "Look for lifted, curled or missing shingles after winter winds. Binoculars beat a ladder.",
      },
      {
        title: "Restart the outdoor taps",
        detail:
          "Open them slowly and check the wall inside for leaks — a pipe that froze over winter will tell you now.",
      },
      {
        title: "Service the air conditioner",
        detail:
          "Clean or replace the filter and clear the outdoor unit before the first hot week, not during it.",
      },
      {
        title: "Rake out the lawn once it is dry",
        detail:
          "Pull up matted, snow-mouldy patches, then overseed bare spots while spring moisture lasts.",
      },
      {
        title: "Clean the dryer vent line",
        detail:
          "Lint plus a winter of heavy loads is a fire risk and the reason drying takes two cycles.",
      },
      {
        title: "Test smoke and CO detectors",
        detail:
          "Fresh batteries, and check the expiry date printed on the carbon monoxide alarm itself.",
      },
      {
        title: "Book spring cleanup early",
        detail:
          "Yards cleaned up in May recover faster — and spring routes fill up fast.",
      },
    ],
  },
  {
    season: "Summer",
    timing: "June to August · growth season",
    intro:
      "Everything grows, including the repair list. Summer is for keeping up — and for the exterior jobs that need dry weather.",
    items: [
      {
        title: "Mow high",
        detail:
          "Cut at 8–9 cm. Taller grass shades out weeds and grows deeper roots for dry spells.",
      },
      {
        title: "Water deep, early, and less often",
        detail:
          "A long morning soak beats daily sprinkles that keep roots shallow.",
      },
      {
        title: "Check caulking and weatherstripping",
        detail:
          "Summer storms find every gap. Look at windows, doors and where siding meets trim.",
      },
      {
        title: "Change the furnace filter",
        detail:
          "The fan runs all summer for air conditioning too. A clogged filter makes it work harder at both jobs.",
      },
      {
        title: "Walk the deck and fence",
        detail:
          "Loose boards, popped nails and soft spots at ground level are easier to fix now than after rot spreads.",
      },
      {
        title: "Trim branches off the roof",
        detail:
          "Keep limbs clear of shingles. Anything touching the power service line itself is Manitoba Hydro's job — call them.",
      },
      {
        title: "Wash the siding and walkways",
        detail:
          "Algae and mildew get slippery and eat paint. Summer is pressure-washing weather.",
      },
      {
        title: "Look in the attic hatch",
        detail:
          "Check for signs of pests, leaks around vents, and insulation that has shifted or flattened.",
      },
      {
        title: "Seal driveway and walkway cracks",
        detail:
          "Small cracks sealed now stay small; the fall freeze will widen whatever you leave.",
      },
      {
        title: "Plan fall projects now",
        detail:
          "Good fall calendars fill in August. The time to book a fence or deck repair is before you need it.",
      },
    ],
  },
  {
    season: "Fall",
    timing: "September to November · before the snow",
    intro:
      "Fall is the highest-stakes season in Winnipeg. Almost every expensive winter problem — ice dams, burst pipes, mice — is a fall job that did not get done.",
    items: [
      {
        title: "Clean the eavestroughs after leaf fall",
        detail:
          "Full troughs freeze, back up under the shingles and become ice dams. This is the single best hour you can spend in October.",
      },
      {
        title: "Shut off and drain exterior taps",
        detail:
          "Close the inside valve, open the outside tap, drain the line. Do the same for hoses and store them inside.",
      },
      {
        title: "Service the furnace",
        detail:
          "A filter, a check-up and a test run in September beats an emergency call at −30 in January.",
      },
      {
        title: "Seal where mice get in",
        detail:
          "A mouse needs a hole the size of a dime. Check where pipes, cables and vents pass through the walls.",
      },
      {
        title: "Do the final mow and leaf cleanup",
        detail:
          "Leaves left on the lawn mat down under snow and kill the grass beneath. Mulch or remove them.",
      },
      {
        title: "Aerate and fertilize",
        detail:
          "Roots grow in fall even when the top does not. Fall feeding is why some lawns green up first in spring.",
      },
      {
        title: "Check roof valleys and flashing",
        detail:
          "The spots that will leak under snow load are visible now, while you can still fix them.",
      },
      {
        title: "Start the snowblower in October",
        detail:
          "Fresh fuel, a test run and spare shear pins on the shelf. The first storm is the wrong day to find out.",
      },
      {
        title: "Clear and cover the A/C unit",
        detail:
          "Brush off debris and cover the top to keep snow out of the fan. Leave the sides open so moisture can escape.",
      },
      {
        title: "Book snow removal before the first snowfall",
        detail:
          "Routes are built in the fall. Once the snow flies, the good ones are full.",
      },
    ],
  },
  {
    season: "Winter",
    timing: "December to February · keep it running",
    intro:
      "Winter is not a project season — it is a monitoring season. A few small checks keep the house safe at −30.",
    items: [
      {
        title: "Change the furnace filter monthly",
        detail:
          "In deep cold the furnace runs almost constantly. A fresh filter is cheaper than a service call.",
      },
      {
        title: "Keep exterior vents clear of snow",
        detail:
          "Furnace, dryer and HRV vents blocked by drifts can push carbon monoxide back into the house. Clear them after every big snowfall.",
      },
      {
        title: "Watch for ice dams",
        detail:
          "Thick ice at the roof edge and icicles in new places mean heat is escaping. Rake snow off the bottom edge if you can do it safely from the ground.",
      },
      {
        title: "Protect pipes on exterior walls",
        detail:
          "During cold snaps, open the cabinet doors under sinks — and know where your main water shutoff is before you ever need it.",
      },
      {
        title: "Keep the gas meter reachable",
        detail:
          "Clear a path and brush snow off gently. The meter reader — and emergency crews — need access.",
      },
      {
        title: "Clear snow from basement window wells",
        detail:
          "Snow piled against egress windows blocks an exit and melts against the foundation in spring.",
      },
      {
        title: "Watch window condensation",
        detail:
          "Heavy frost on the inside of windows means indoor humidity is too high for the temperature. Run the HRV or a bathroom fan.",
      },
      {
        title: "Run ceiling fans on low, reversed",
        detail:
          "Clockwise at low speed pushes pooled warm air back down where you can feel it.",
      },
      {
        title: "Feel for drafts at the attic hatch",
        detail:
          "A poor seal leaks heated air all winter — and that escaping heat is what feeds ice dams.",
      },
      {
        title: "Book spring work early",
        detail:
          "January is when smart homeowners book spring cleanups and repairs. You will get your pick of dates.",
      },
    ],
  },
];
