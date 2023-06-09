import { Database } from "../../../lib/database.types.ts";
import { PostgrestQueryBuilder } from "@supabase/postgrest-js";
import { createClient, GenericTable, GenericView } from "@supabase/supabase-js";


export const createHeaders = (url: URL) => {
    return {
        "Host": url.host,
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

export const createResponse = (fieldName: string, url: string) => new Response(
    JSON.stringify({ [fieldName]: url }),
    { headers: { "Content-Type": "application/json" } },
);

export type ResolveInput = {
    url: string,
}

type PublicSchema = Database["public"]
export type TableSchema = PublicSchema["Tables"]

export class DatabaseCache<Relation extends GenericTable | GenericView> {
    private readonly queryBuilder: PostgrestQueryBuilder<PublicSchema, Relation>;
    private readonly resolvedUrlColumn: keyof Relation["Row"];
    private readonly inputUrlColumn: keyof Relation["Row"];
    private readonly responseField: string;

    constructor(queryBuilder: PostgrestQueryBuilder<PublicSchema, Relation>, resolvedUrlColumn: keyof Relation["Row"], inputUrlColumn: keyof Relation["Row"], responseField: string) {
        this.queryBuilder = queryBuilder;
        this.resolvedUrlColumn = resolvedUrlColumn;
        this.inputUrlColumn = inputUrlColumn;
        this.responseField = responseField;
    }

    async tryFindCached(url: string) {
        const {
            data,
            error
        } = await this.queryBuilder.select(this.resolvedUrlColumn).eq(this.inputUrlColumn, url);

        // @ts-ignore This is fine typescript wth .-.
        if (data?.length > 0 && error === null) {
            // @ts-ignore Using resolvedColumn as index is fine since we select it above
            return createResponse(this.responseField, data[0][this.resolvedUrlColumn]);
        }

        return null;
    }

    async tryCache(inputUrl: string, resolvedUrl: string) {
        // @ts-ignore This is fine since columns are strings
        await this.queryBuilder.insert({
            [this.inputUrlColumn]: inputUrl,
            [this.resolvedUrlColumn]: resolvedUrl
        });
    }
}

export function createCache<Relation extends GenericTable | GenericView>(table: string, resolvedUrlColumn: keyof Relation["Row"], inputUrlColumn: keyof Relation["Row"], responseField: string) {
    const client = createClient<Database>(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );


    return new DatabaseCache<Relation>(client.from(table), resolvedUrlColumn, inputUrlColumn, responseField);
}
