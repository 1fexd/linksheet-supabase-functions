import { createCache, createHeaders, TableSchema } from "../_shared/common.ts";
import { trackers } from "../_shared/tracker.ts";

const maxTries = 5;
const wasRedirected = (status: number) => status >= 300 || status <= 399;

export const isTracker = (url: string) => trackers.find(tracker => tracker.test(url));

const responseField = "resolvedUrl";

export const redirectorCache = createCache<TableSchema["resolved_urls"]>("resolved_urls",
    "resolved_url", "short_url",
    responseField
);

export const getResolvedUrl = async (urlObj: URL, getBody = false): Promise<{ url: URL | null, body?: string }> => {
    let resolvedUrl = urlObj;

    let lastResp = null;
    let lastStatus = -1;

    let counter = 0;
    while (counter === 0 || !wasRedirected(lastStatus)) {
        lastResp = await fetch(resolvedUrl.toString(), {
            method: getBody ? "GET" : "HEAD",
            redirect: "manual",
            headers: lastStatus >= 400 && lastStatus <= 499 ? createHeaders(resolvedUrl) : {}
        });

        if (wasRedirected(lastResp.status)) {
            const location = lastResp.headers.get("Location");
            if (location !== null) {
                resolvedUrl = new URL(location);
            }
        }

        lastStatus = lastResp.status;
        if (counter++ === maxTries) {
            return { url: null };
        }
    }

    const body = getBody ? await lastResp!.text() : undefined;
    return { url: resolvedUrl, body: body };
}
