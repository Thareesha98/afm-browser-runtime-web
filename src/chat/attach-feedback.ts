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

export interface SkippedFile {
  name: string;
  reason: string;
}

const LISTED = 3;

function nameList(names: string[]): string {
  if (names.length <= LISTED) return names.join(", ");
  return `${names.slice(0, LISTED).join(", ")} and ${names.length - LISTED} more`;
}

export function attachFeedback(attached: string[], skipped: SkippedFile[]): string | null {
  const sentences: string[] = [];
  if (attached.length > 0) sentences.push(`Attached ${nameList(attached)}.`);
  for (const file of skipped.slice(0, 2)) sentences.push(`${file.name} ${file.reason.replace(/\.+$/, "")}.`);
  if (skipped.length > 2) sentences.push(`${skipped.length - 2} more skipped.`);
  return sentences.length === 0 ? null : sentences.join(" ");
}
