import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createCache, createResponse, ResolveInput, TableSchema } from "../_shared/common.ts";
import { getResolvedUrl, isTracker, redirectorCache } from "./redirector.ts";

const responseField = "resolvedUrl";

const createErrorResponse = (message: string) => new Response(JSON.stringify({ "error": message }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
});

serve(async (req) => {
    const { url } = await req.json() as ResolveInput;

    if (!isTracker(url)) {
        console.log(`Requested url ${url} is not a tracker`);
        return createErrorResponse("Request url is not a known to be a tracker");
    }

    const cached = await redirectorCache.tryFindCachedWithResponse(url);
    if (cached !== null) {
        console.log(`Returning cached url for ${url}`)
        return cached;
    }

    console.log(`Looking up ${url}`)

    const urlObj = new URL(url);
    const { url: resolvedUrl } = await getResolvedUrl(urlObj);

    if (resolvedUrl === null) {
        return createErrorResponse("Max tries exceeded");
    }

    console.log(`Found ${resolvedUrl} for ${url}`);
    if (urlObj.host !== resolvedUrl.host) {
        await redirectorCache.tryCache(urlObj.toString(), resolvedUrl.toString());
    }

    return createResponse(responseField, resolvedUrl.toString());
});
