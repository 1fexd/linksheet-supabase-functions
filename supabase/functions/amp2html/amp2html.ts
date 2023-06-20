import { DOMParser, Element, } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { createCache, createHeaders, TableSchema } from "../_shared/common.ts";

const findCanonical = (location: string, body: string, referrer?: string): string | null => {
    const document = new DOMParser().parseFromString(body, "text/html")!;

    const ampLink = document.querySelector("link[rel~='amphtml'][href]");
    const canonicalLink = document.querySelector("link[rel~='canonical'][href]");

    const ampHref = href(ampLink)
    const canonicalHref = href(canonicalLink);

    const ampHtml = document.querySelector("html[amp],html[⚡]");

    if (ampHtml || (ampLink !== null && ampHref == location)) {
        if (canonicalHref !== null && ampHref !== canonicalHref) {
            if (location !== canonicalHref && referrer !== canonicalHref) {
                return canonicalHref;
            }
        }
    }

    return null;
};

const href = (element: Element | null) => element?.getAttribute("href") ?? null;

export const amp2HtmlResponseField = "canonicalUrl";

export const amp2HtmlCache = createCache<TableSchema["amp2html_urls"]>("amp2html_urls",
    "canonical_url", "amp_url",
    amp2HtmlResponseField
);

export const getCanonicalUrl = async (ampUrl: string, referrer?: string, body?: string) => {
    if (!body) {
        const urlObj = new URL(ampUrl);
        const resp = await fetch(ampUrl, { headers: createHeaders(urlObj) });

        return findCanonical(ampUrl, await resp.text(), referrer);
    }

    return findCanonical(ampUrl, body, referrer);
}
