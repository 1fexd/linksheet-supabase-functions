import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createResponse, ResolveInput } from "../_shared/common.ts";
import { amp2HtmlCache, amp2HtmlResponseField, getCanonicalUrl } from "./amp2html.ts";


serve(async (req) => {
    const { url, referrer } = await req.json() as ResolveInput & { referrer?: string };

    const cached = await amp2HtmlCache.tryFindCachedWithResponse(url);
    if (cached !== null) {
        console.log(`Returning cached url for ${url}`)
        return cached;
    }

    console.log(`Looking up ${url}`)

    const canonicalUrl = await getCanonicalUrl(url, referrer);
    if (canonicalUrl === null) {
        return new Response(JSON.stringify({ "error": "No non-AMP version found!" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    console.log(`Found ${canonicalUrl} for ${url}`);

    await amp2HtmlCache.tryCache(url, canonicalUrl);
    return createResponse(amp2HtmlResponseField, canonicalUrl);
});
