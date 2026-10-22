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

import type { SecretPort } from "@afm/engine";
import { configSecretPort, passkey } from "@afm/adapter-secret";
import type { KeyValueStore } from "@afm/adapter-auth";
import type { ServerMessage } from "./protocol";

export interface WorkerSecretStore {
  memoryPort: SecretPort;
  refreshStore: KeyValueStore;
  approvedFor(name: string, address: string | undefined): boolean;
  opened(): Promise<void>;
  set(name: string, value: string, address?: string): void;
  remove(name: string): void;
  acceptUnlock(name: string, key: CryptoKey): void;
  seal(name: string, key: CryptoKey, credentialId: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>): void;
  reseal(
    name: string,
    from: CryptoKey,
    to: CryptoKey,
    credentialId: Uint8Array<ArrayBuffer>,
    salt: Uint8Array<ArrayBuffer>,
  ): void;
  forgetSealed(name: string): void;
  postNames(): void;
  postSealedNames(): void;
}

export function createWorkerSecretStore(emit: (message: ServerMessage) => void): WorkerSecretStore {
  const values: Record<string, string> = Object.create(null);
  const approvals = new Map<string, Set<string>>();

  const sealingKeys = new Map<string, { key: CryptoKey; credentialId: Uint8Array<ArrayBuffer>; salt: Uint8Array<ArrayBuffer> }>();

  let unlocking: Promise<unknown> = Promise.resolve();

  function postNames(): void {
    emit({ type: "secrets-list", names: Object.keys(values) });
  }

  function postSealedNames(): void {
    void passkey.listNames()
      .then((names) => emit({ type: "passkey-list", names }))
      .catch(() => emit({ type: "passkey-list", names: [] }));
  }

  const sealedBlob = (name: string) => passkey.loadBlob(name).catch(() => null);

  async function decryptInto(name: string, key: CryptoKey, blob: passkey.StoredSecret): Promise<string | null> {
    try {
      const value = await passkey.decryptString(key, blob);
      values[name] = value;
      approvals.set(name, new Set(blob.addresses));
      sealingKeys.set(name, { key, credentialId: blob.credentialId, salt: blob.salt });
      postNames();
      return value;
    } catch {
      return null;
    }
  }

  const refreshStore: KeyValueStore = {
    get: (key) => values[key] ?? null,
    set: (key, value) => {
      values[key] = value;
      postNames();
      const sealing = sealingKeys.get(key);
      if (sealing === undefined) return;
      return passkey.encryptString(sealing.key, value)
        .then((sealed) => (values[key] === value ? passkey.saveBlob(key, { ...sealed, credentialId: sealing.credentialId, salt: sealing.salt }) : undefined))
        .catch(() => {});
    },
    remove: (key) => {
      delete values[key];
      sealingKeys.delete(key);
      postNames();
    },
  };

  return {
    memoryPort: configSecretPort(values),
    refreshStore,
    postNames,
    postSealedNames,

    approvedFor: (name, address) => address !== undefined && approvals.get(name)?.has(address) === true,

    opened: () => unlocking.then(() => undefined),

    set(name, value, address) {
      if (value === "") return;
      values[name] = value;
      approvals.set(name, new Set(address === undefined ? [] : [address]));
      postNames();
    },

    remove(name) {
      delete values[name];
      approvals.delete(name);
      postNames();
    },

    acceptUnlock(name, key) {
      unlocking = unlocking
        .then(() => sealedBlob(name))
        .then((blob) => (blob === null ? null : decryptInto(name, key, blob)));
    },

    seal(name, key, credentialId, salt) {
      const value = values[name] ?? "";
      if (value === "") return;
      const addresses = [...(approvals.get(name) ?? [])];
      void passkey.encryptString(key, value)
        .then((sealed) => passkey.saveBlob(name, { ...sealed, credentialId, salt, addresses }))
        .then(() => {
          sealingKeys.set(name, { key, credentialId, salt });
          postSealedNames();
        })
        .catch(() => emit({ type: "notice", text: `${name} could not be saved for next time. It still works for this tab.` }));
    },

    reseal(name, from, to, credentialId, salt) {
      void sealedBlob(name)
        .then(async (blob) => {
          if (blob === null) return;
          const sealed = await passkey.encryptString(to, await passkey.decryptString(from, blob));
          await passkey.saveBlob(name, { ...sealed, credentialId, salt, addresses: blob.addresses });
          sealingKeys.set(name, { key: to, credentialId, salt });
        })
        .catch(() => {});
    },

    forgetSealed(name) {
      sealingKeys.delete(name);
      void passkey.removeBlob(name).then(postSealedNames).catch(() => {});
    },
  };
}
