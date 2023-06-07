import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const defaultHeaders = (url) => {
    return {
        "Host": new URL(url).host,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:110.0) Gecko/20100101 Firefox/110.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
    }
};
const maxTries = 5;

const returnCanonicalUrl = (canonicalUrl: string): Response => {
    return new Response(
        JSON.stringify({ "canonicalUrl": canonicalUrl }),
        { headers: { "Content-Type": "application/json" } },
    );
}

const findCanonical = (body: string, referrer: string): string | null => {
    const document = new DOMParser().parseFromString(body);

    const ampLink = document.head.querySelector("link[rel~='amphtml'][href]");
    const canonicalLink = document.head.querySelector("link[rel~='canonical'][href]");

    if (document.querySelector("html[amp],html[⚡]") || (null != ampLink && ampLink.href == document.location.href)) {
        if (null != canonicalLink && canonicalLink.href != null && !(ampLink != null && ampLink.href == canonicalLink.href)) {
            if (null != canonicalLink.href && document.location.href != canonicalLink.href && referrer != canonicalLink.href) {
                return canonicalLink.href;
            }
        }
    }

    return null;
};

serve(async (req) => {
    const { url, referrer } = await req.json()

    const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const cachedResolvedUrl = await supabaseClient.from("amp2html_urls").select("canonical_url").eq("amp_url", url);
    if (cachedResolvedUrl.data.length > 0) {
        console.log(`Returning cached url for ${url}`)
        return returnCanonicalUrl(cachedResolvedUrl.data[0]["canonical_url"]);
    }

    console.log(`Looking up ${url}`)

    const resp = await fetch(url, { headers: defaultHeaders(url) });
    const body = await resp.text();

    const canonicalUrl = findCanonical(body, referrer);
    if (canonicalUrl === null) {
        return new Response(JSON.stringify({ "error": "No non-AMP version found!" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    console.log(`Found ${canonicalUrl} for ${url}`);
    await supabaseClient.from("amp2html_urls").insert({ amp_url: url, canonical_url: canonicalUrl });
    return returnCanonicalUrl(resolvedUrl);
});
