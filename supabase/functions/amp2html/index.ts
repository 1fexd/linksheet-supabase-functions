import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DOMParser, Element, } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { createCache, createHeaders, createResponse, ResolveInput, TableSchema } from "../_shared/common.ts";

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
const responseField = "canonicalUrl";

serve(async (req) => {
    const { url, referrer } = await req.json() as ResolveInput & { referrer?: string };

    const cache = createCache<TableSchema["amp2html_urls"]>("amp2html_urls",
        "canonical_url", "amp_url",
        responseField
    );

    const cached = await cache.tryFindCached(url);
    if (cached !== null) {
        console.log(`Returning cached url for ${url}`)
        return cached;
    }

    console.log(`Looking up ${url}`)

    const urlObj = new URL(url);
    const resp = await fetch(url, { headers: createHeaders(urlObj) });
    const body = await resp.text();

    const canonicalUrl = findCanonical(url, body, referrer);
    if (canonicalUrl === null) {
        return new Response(JSON.stringify({ "error": "No non-AMP version found!" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    console.log(`Found ${canonicalUrl} for ${url}`);

    await cache.tryCache(url, canonicalUrl);
    return createResponse(responseField, canonicalUrl);
});
