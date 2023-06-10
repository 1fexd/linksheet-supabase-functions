import json

with open("rules.json", "r") as file:
    trackers = json.load(file)["tracker"]

__WILDCARD_START = "*://*."
__WILDCARD_START_REGEX = ".*:\\/\\/.*"

regexes = []
for tracker in trackers:
    start = ""
    if tracker.startswith(__WILDCARD_START):
        start = __WILDCARD_START_REGEX
        tracker = tracker[len(__WILDCARD_START):]

    tracker = start + tracker.replace(".", "\\.").replace("/", "\\/").replace("*", ".*").replace("?", "\\?")
    regexes.append(f"new RegExp(\"{tracker}\", \"i\"),")

with open("../supabase/functions/_shared/tracker.ts", "w") as ts_file:
    ts_file.write("export const trackers = [")
    for regex in regexes:
        ts_file.write(regex)
    ts_file.write("];")
