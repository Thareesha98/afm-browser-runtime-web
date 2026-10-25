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

import { useEffect, useState } from "react";
import { LEAVE_MS } from "./use-ready-chip";

export function useLingering<T>(items: readonly T[]): { items: readonly T[]; leaving: boolean } {
  const [kept, setKept] = useState<readonly T[]>(items);

  useEffect(() => {
    if (items.length > 0) {
      setKept(items);
      return;
    }
    const timer = window.setTimeout(() => setKept(items), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [items]);

  return { items: kept, leaving: items.length === 0 && kept.length > 0 };
}
