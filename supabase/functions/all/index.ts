import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createResponse, ResolveInput } from "../_shared/common.ts";
import { getResolvedUrl, isTracker, redirectorCache } from "../redirector/redirector.ts";
import { amp2HtmlCache, getCanonicalUrl } from "../amp2html/amp2html.ts";

serve(async (req) => {
    const { url, referrer, operations } = await req.json() as ResolveInput & {
        operations: string[],
        referrer?: string
    };

    const operationResult: { [key: string]: string } = {};

    let inputUrl = url;
    let redirectBody = undefined;
    if (operations.includes("redirect")) {
        if (isTracker(url)) {
            const cachedResolveUrl = await redirectorCache.tryFindCached(url);
            if (cachedResolveUrl !== null) {
                console.log(`Found cached resolveUrl for ${url}`)
                inputUrl = cachedResolveUrl;
            } else {
                const urlObj = new URL(url);
                console.log(`Looking up resolveUrl for ${url}`)

                const { url: resolvedUrl, body } = await getResolvedUrl(urlObj, operations.length > 1);
                if (resolvedUrl !== null) {
                    console.log(`Found resolveUrl ${resolvedUrl} for ${url}`);
                    if (urlObj.host !== resolvedUrl.host) {
                        await redirectorCache.tryCache(urlObj.toString(), resolvedUrl.toString());
                    }

                    inputUrl = resolvedUrl.toString();
                    if (body) {
                        redirectBody = body;
                    }
                } else {
                    operationResult["redirect"] = "Max tries exceeded";
                }
            }
        } else {
            operationResult["redirect"] = "Request url is not a known to be a tracker";
        }
    }

    if (operations.includes("amp2html")) {
        const cachedCanonicalUrl = await amp2HtmlCache.tryFindCached(inputUrl);
        if (cachedCanonicalUrl !== null) {
            console.log(`Found cached canonicalUrl for ${url}`)
            inputUrl = cachedCanonicalUrl;
        } else {
            console.log(`Looking up canonicalUrl for ${url}`)
            const canonicalUrl = await getCanonicalUrl(url, referrer, redirectBody);
            if (canonicalUrl !== null) {
                console.log(`Found canonicalUrl ${canonicalUrl} for ${url}`);
                await amp2HtmlCache.tryCache(url, canonicalUrl);
                inputUrl = canonicalUrl;
            } else {
                operationResult["amp2html"] = "No non-AMP version found!";
            }
        }
    }

    return createResponse("result", inputUrl, { results: operationResult });
});
