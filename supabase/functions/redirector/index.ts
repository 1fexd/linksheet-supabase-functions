import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createCache, createHeaders, createResponse, ResolveInput, TableSchema } from "../_shared/common.ts";


const maxTries = 5;

const wasRedirected = (status: number) => status >= 300 || status <= 399;
const responseField = "resolvedUrl";

serve(async (req) => {
    const { url } = await req.json() as ResolveInput;

    const cache = createCache<TableSchema["resolved_urls"]>("resolved_urls",
        "resolved_url", "short_url",
        responseField
    );

    const cached = await cache.tryFindCached(url);
    if (cached !== null) {
        console.log(`Returning cached url for ${url}`)
        return cached;
    }

    console.log(`Looking up ${url}`)

    const urlObj = new URL(url);
    let resolvedUrl = urlObj;
    let lastStatus = -1;

    let counter = 0;
    while (counter === 0 || !wasRedirected(lastStatus)) {
        console.log(resolvedUrl.toString());
        const resp = await fetch(resolvedUrl.toString(), {
            method: "HEAD",
            redirect: "manual",
            headers: lastStatus >= 400 && lastStatus <= 499 ? createHeaders(resolvedUrl) : {}
        });

        if (wasRedirected(resp.status)) {
            const location = resp.headers.get("Location");
            if (location !== null) {
                resolvedUrl = new URL(location);
            }
        }

        lastStatus = resp.status;
        if (counter++ === maxTries) {
            break;
        }
    }

    if (counter === maxTries) {
        return new Response(JSON.stringify({ "error": "Max retries exceeded" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    console.log(`Found ${resolvedUrl} for ${url}`);
    if (urlObj.host !== resolvedUrl.host) {
        await cache.tryCache(urlObj.toString(), resolvedUrl.toString());
    }

    return createResponse(responseField, resolvedUrl.toString());
});
