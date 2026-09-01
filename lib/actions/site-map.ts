// Per-business "site maps" that power the widget's agentic actions.
//
// Two action types:
//   - navigate: send the visitor to an exact page/section of the HOST site
//     ("show me the graphic design services" -> /services#graphic-design)
//   - prefill:  fill the host site's lead form with details the visitor gave
//     in chat, then scroll them to it (they still press submit themselves).
//
// Claude can only ever emit paths/anchors/field keys that appear here, and
// the widget re-validates on the host side (same-origin paths only), so a
// hostile prompt can never redirect a visitor off-site.

export interface SiteAnchor {
  anchor: string; // element id on the page, without '#'
  title: string;
}

export interface SitePage {
  path: string; // host-site-relative, e.g. "/services"
  title: string;
  anchors?: SiteAnchor[];
}

export interface SiteFormField {
  key: string; // field id on the host page
  label: string;
  options?: string[]; // for <select> fields: the exact allowed values
}

export interface SiteLeadForm {
  path: string; // page containing the form
  fields: SiteFormField[];
}

export interface SiteMap {
  origin: string; // canonical host, informational only
  pages: SitePage[];
  leadForm?: SiteLeadForm;
}

export type WidgetAction =
  | { type: "navigate"; path: string; anchor?: string; label: string }
  | {
      type: "prefill";
      path: string;
      label: string;
      fields: Record<string, string>;
    };

export const SITE_MAPS: Record<string, SiteMap> = {
  // HKH Agency (hkh.agency)
  "00000000-0000-4000-8000-000000000043": {
    origin: "https://www.hkh.agency",
    pages: [
      { path: "/", title: "Home" },
      {
        path: "/services",
        title: "Services",
        anchors: [
          { anchor: "graphic-design", title: "Graphic Design" },
          { anchor: "branding", title: "Branding" },
          {
            anchor: "social-media-marketing",
            title: "Social Media Marketing",
          },
          { anchor: "website-development", title: "Website Development" },
          { anchor: "app-development", title: "App Development" },
          { anchor: "ppc-calculator", title: "PPC budget calculator" },
        ],
      },
      { path: "/contact", title: "Contact / lead form" },
    ],
    leadForm: {
      path: "/contact",
      fields: [
        { key: "fullName", label: "Full Name" },
        { key: "email", label: "Email Address" },
        {
          key: "projectFocus",
          label: "Project Focus",
          options: [
            "Graphic Design",
            "Branding",
            "Social Media Marketing",
            "Website Development",
            "App Development",
            "Paid Campaigns (PPC)",
            "Other Consultation",
          ],
        },
        {
          key: "budgetRange",
          label: "Monthly Budget",
          options: [
            "AED 5,000 – AED 15,000",
            "AED 15,000 – AED 35,000",
            "AED 35,000 – AED 75,000",
            "AED 75,000 – AED 150,000",
            "AED 150,000 – AED 500,000",
            "AED 500,000+",
          ],
        },
        { key: "message", label: "How can we help your business?" },
      ],
    },
  },
};

export function getSiteMap(businessId: string): SiteMap | undefined {
  return SITE_MAPS[businessId];
}

// Server-side whitelist: drop anything Claude emits that isn't in the map, so
// only known paths/anchors/field keys ever reach the widget.
export function sanitizeAction(
  map: SiteMap,
  raw: unknown
): WidgetAction | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Record<string, unknown>;
  const label =
    typeof a.label === "string" ? a.label.trim().slice(0, 160) : "";

  if (a.type === "navigate") {
    const path = typeof a.path === "string" ? a.path : "";
    const page = map.pages.find((p) => p.path === path);
    if (!page) return undefined;
    let anchor: string | undefined;
    if (typeof a.anchor === "string" && a.anchor) {
      const known = page.anchors?.some((x) => x.anchor === a.anchor);
      if (!known) anchor = undefined;
      else anchor = a.anchor;
    }
    return { type: "navigate", path, anchor, label };
  }

  if (a.type === "prefill") {
    const form = map.leadForm;
    if (!form) return undefined;
    const rawFields =
      a.fields && typeof a.fields === "object"
        ? (a.fields as Record<string, unknown>)
        : {};
    const fields: Record<string, string> = {};
    for (const field of form.fields) {
      const v = rawFields[field.key];
      if (typeof v !== "string") continue;
      const value = v.trim().slice(0, 1000);
      if (!value) continue;
      if (field.options && !field.options.includes(value)) continue;
      fields[field.key] = value;
    }
    if (Object.keys(fields).length === 0) return undefined;
    return { type: "prefill", path: form.path, label, fields };
  }

  return undefined;
}
