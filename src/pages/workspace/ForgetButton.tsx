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

import { useRef, useState } from "react";
import { ConfirmNote } from "./ConfirmNote";

export function ForgetButton({ name, onForget }: { name: string; onForget: () => void }) {
  const [asking, setAsking] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function cancel() {
    setAsking(false);
    trigger.current?.focus();
  }

  return (
    <span className="u-forget" ref={wrap}>
      <button
        className="u-btn quiet sm"
        ref={trigger}
        aria-label={`Forget ${name}`}
        aria-haspopup="dialog"
        aria-expanded={asking}
        onClick={() => setAsking(!asking)}
      >
        Forget
      </button>
      {asking && (
        <ConfirmNote
          title="Forget this key?"
          text={`${name} will be removed. You will need to paste it again to use it.`}
          secondary={{ label: "Cancel", onPick: cancel }}
          primary={{
            label: "Forget",
            onPick: () => {
              setAsking(false);
              onForget();
            },
          }}
          focus="secondary"
          onDismiss={cancel}
          wrap={wrap}
          align="end"
        />
      )}
    </span>
  );
}
