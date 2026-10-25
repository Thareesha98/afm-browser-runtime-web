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

import { useState } from "react";

export function ForgetConfirm({ name, onCancel, onForget }: { name: string; onCancel: () => void; onForget: () => void }) {
  return (
    <span
      className="u-forget"
      role="group"
      aria-label={`Forget ${name}?`}
      onKeyDown={(event) => event.key === "Escape" && onCancel()}
    >
      <button className="u-btn quiet sm" autoFocus onClick={onCancel}>
        Cancel
      </button>
      <button className="u-btn danger sm" onClick={onForget}>
        Forget
      </button>
    </span>
  );
}

export function ForgetButton({ name, onForget }: { name: string; onForget: () => void }) {
  const [asking, setAsking] = useState(false);

  if (asking) return <ForgetConfirm name={name} onCancel={() => setAsking(false)} onForget={onForget} />;
  return (
    <button className="u-btn quiet sm" aria-label={`Forget ${name}`} onClick={() => setAsking(true)}>
      Forget
    </button>
  );
}
