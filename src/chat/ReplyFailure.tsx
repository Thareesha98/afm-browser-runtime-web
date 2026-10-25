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

import { brief } from "../brief-error";

const KEY_REJECTED = "Key not accepted";

interface Props {
  message: string;
  onRetry?: () => void;
  onReplaceKey?: () => void;
}

export function ReplyFailure({ message, onRetry, onReplaceKey }: Props) {
  const text = brief(message);
  return (
    <div className="reply-failure" role="alert">
      <span className="reply-failure-dot" aria-hidden="true" />
      <span className="reply-failure-text">{text}</span>
      {text === KEY_REJECTED && onReplaceKey !== undefined && (
        <button className="u-btn ghost sm" onClick={onReplaceKey}>
          Replace key
        </button>
      )}
      {onRetry !== undefined && (
        <button className="u-btn ghost sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
