import {serve} from "https://deno.land/std@0.168.0/http/server.ts"
import {createClient} from "https://esm.sh/@supabase/supabase-js@2"

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

const returnResolvedUrl = (resolvedUrl) => {
    return new Response(
        JSON.stringify({"resolvedUrl": resolvedUrl}),
        {headers: {"Content-Type": "application/json"}},
    );
}

serve(async (req) => {
    const {url} = await req.json()

    const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const cachedResolvedUrl = await supabaseClient.from("resolved_urls").select("resolved_url").eq("short_url", url);
    if (cachedResolvedUrl.data.length > 0) {
        console.log(`Returning cached url for ${url}`)
        return returnResolvedUrl(cachedResolvedUrl.data[0]["resolved_url"]);
    }

    console.log(`Looking up ${url}`)
    let resolvedUrl: string = url;
    let lastStatus = -1;

    let counter = 0;
    while (counter === 0 || (lastStatus >= 300 || lastStatus <= 399)) {
        const resp = await fetch(resolvedUrl, {
            method: "HEAD",
            redirect: "manual",
            headers: lastStatus >= 400 && lastStatus <= 499 ? defaultHeaders(resolvedUrl) : {}
        });

        if (resp.status >= 300 && resp.status <= 399) {
            resolvedUrl = resp.headers.get("Location")
        }

        lastStatus = resp.status;
        if (counter++ === maxTries) {
            break;
        }
    }

    if (counter === maxTries) {
        return new Response(JSON.stringify({"error": "Max retries exceeded"}), {
            status: 400,
            headers: {"Content-Type": "application/json"}
        })
    }

    console.log(`Found ${resolvedUrl} for ${url}`)
    if (new URL(resolvedUrl).hostname !== new URL(url).hostname) {
        await supabaseClient.from("resolved_urls").insert({resolved_url: resolvedUrl, short_url: url});
    }

    return returnResolvedUrl(resolvedUrl);
});
