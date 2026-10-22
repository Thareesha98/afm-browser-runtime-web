// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.


// Long technical errors belong in the browser console. The screen gets a few words.

const RULES: [RegExp, string][] = [
  [/mcp proxy|McpProxyRequired/i, "MCP error"],
  [/api[ _-]?key|invalid[ _-]?key|unauthori[sz]ed|\b40[13]\b/i, "Key not accepted"],
  [/failed to fetch|networkerror|load failed|network request failed/i, "Can't be reached"],
  [/timed out|timeout|did not answer|\b408\b|\b504\b/i, "Took too long"],
  [/rate limit|too many requests|overloaded|\b429\b|\b50[03]\b|\b529\b/i, "Busy right now"],
];

// A short message that tells the person what to do is kept as it is ("Allow pop-ups for this site to sign in.")
const SHORT_ENOUGH = 40;

// What to show for a message that came from the engine, the network or a server.
export function briefMessage(message: string): string {
  const text = message.trim();
  for (const [pattern, short] of RULES) {
    if (pattern.test(text)) return short;
  }
  if (text.length <= SHORT_ENOUGH) return text;
  return /sign-?in/i.test(text) ? "Sign-in failed" : "Something went wrong";
}

const logged = new Set<string>();

// briefMessage, and the full text goes to the console once.
export function brief(message: string): string {
  const short = briefMessage(message);
  if (short !== message.trim() && !logged.has(message)) {
    logged.add(message);
    console.error(message);
  }
  return short;
}

// Write a failure's full text to the console once (for a short label that is already on the screen).
export function logDetails(message: string): void {
  if (message === "" || logged.has(message)) return;
  logged.add(message);
  console.error(message);
}
