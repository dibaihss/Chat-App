const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") {
    return fallback;
  }
  return String(value).trim().toLowerCase() === "true";
}

function parseIntOrDefault(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function isProductionLike() {
  const nodeEnv = String(process.env.NODE_ENV || "").trim().toLowerCase();
  return nodeEnv === "production";
}

function shouldEnableKeyVault() {
  const raw = process.env.KEY_VAULT_ENABLED;
  if (raw == null || raw === "") {
    return isProductionLike() && Boolean(String(process.env.KEY_VAULT_URI || "").trim());
  }
  return parseBoolean(raw, false);
}

function shouldAllowLocalFallbackOnKeyVaultError() {
  const raw = process.env.KEY_VAULT_ALLOW_LOCAL_FALLBACK;
  if (raw == null || raw === "") {
    return !isProductionLike();
  }
  return parseBoolean(raw, !isProductionLike());
}

function buildSecretSpec() {
  return [
    {
      targetEnv: "COSMOS_CONNECTION_STRING",
      secretName: String(process.env.KEY_VAULT_SECRET_COSMOS_CONNECTION_STRING || "").trim()
    },
    {
      targetEnv: "COSMOS_ENDPOINT",
      secretName: String(process.env.KEY_VAULT_SECRET_COSMOS_ENDPOINT || "").trim()
    },
    {
      targetEnv: "COSMOS_KEY",
      secretName: String(process.env.KEY_VAULT_SECRET_COSMOS_KEY || "").trim()
    },
    {
      targetEnv: "ENTRA_TENANT_ID",
      secretName: String(process.env.KEY_VAULT_SECRET_ENTRA_TENANT_ID || "").trim()
    },
    {
      targetEnv: "ENTRA_ISSUER",
      secretName: String(process.env.KEY_VAULT_SECRET_ENTRA_ISSUER || "").trim()
    },
    {
      targetEnv: "ENTRA_AUDIENCE",
      secretName: String(process.env.KEY_VAULT_SECRET_ENTRA_AUDIENCE || "").trim()
    },
    {
      targetEnv: "ENTRA_JWKS_URI",
      secretName: String(process.env.KEY_VAULT_SECRET_ENTRA_JWKS_URI || "").trim()
    }
  ].filter((entry) => entry.secretName);
}

function createSecretCache({ ttlSeconds }) {
  const cache = new Map();
  const ttlMs = Math.max(ttlSeconds, 0) * 1000;
  return {
    async getOrLoad(secretName, loader) {
      const now = Date.now();
      const cached = cache.get(secretName);
      if (cached && cached.expiresAt > now) {
        return { value: cached.value, source: "cache" };
      }
      const value = await loader(secretName);
      cache.set(secretName, { value, expiresAt: now + ttlMs });
      return { value, source: "key_vault" };
    },
    set(secretName, value) {
      cache.set(secretName, { value, expiresAt: Date.now() + ttlMs });
    }
  };
}

function buildConfigSnapshot() {
  return {
    port: Number.parseInt(process.env.CHAT_API_PORT || "3001", 10),
    webOrigin: process.env.WEB_ORIGIN || "http://localhost:3000",
    authMode: String(process.env.AUTH_MODE || "entra").toLowerCase(),
    cosmos: {
      connectionString: process.env.COSMOS_CONNECTION_STRING,
      endpoint: process.env.COSMOS_ENDPOINT,
      key: process.env.COSMOS_KEY,
      databaseId: process.env.COSMOS_DATABASE_ID || "chat_app",
      messagesContainerId: process.env.COSMOS_MESSAGES_CONTAINER_ID || "messages",
      usersContainerId: process.env.COSMOS_USERS_CONTAINER_ID || "users",
      roomsContainerId: process.env.COSMOS_ROOMS_CONTAINER_ID || "rooms",
      membershipsContainerId: process.env.COSMOS_MEMBERSHIPS_CONTAINER_ID || "room_memberships"
    }
  };
}

function validateConfig(config, { keyVaultEnabled }) {
  const hasConnectionString = Boolean(String(config.cosmos.connectionString || "").trim());
  const hasEndpoint = Boolean(String(config.cosmos.endpoint || "").trim());
  const hasKey = Boolean(String(config.cosmos.key || "").trim());
  if (!hasConnectionString && !(hasEndpoint && hasKey)) {
    const mode = keyVaultEnabled ? "Key Vault + env" : "env";
    throw new Error(
      `Cosmos configuration missing after ${mode} resolution. Set COSMOS_CONNECTION_STRING or COSMOS_ENDPOINT + COSMOS_KEY.`
    );
  }
}

async function hydrateFromKeyVault() {
  const keyVaultEnabled = shouldEnableKeyVault();
  const allowLocalFallback = shouldAllowLocalFallbackOnKeyVaultError();
  const keyVaultUri = String(process.env.KEY_VAULT_URI || "").trim();
  if (!keyVaultEnabled) {
    return {
      keyVaultEnabled: false,
      keyVaultUri: "",
      fetched: [],
      cache: null,
      refreshIntervalSeconds: 0,
      mode: "env"
    };
  }

  if (!keyVaultUri) {
    throw new Error("KEY_VAULT_ENABLED is true but KEY_VAULT_URI is missing.");
  }

  const cacheTtlSeconds = parseIntOrDefault(process.env.KEY_VAULT_CACHE_TTL_SECONDS, 300);
  const refreshIntervalSeconds = parseIntOrDefault(process.env.KEY_VAULT_REFRESH_INTERVAL_SECONDS, 0);
  const secretSpec = buildSecretSpec();
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(keyVaultUri, credential);
  const cache = createSecretCache({ ttlSeconds: cacheTtlSeconds });
  const fetched = [];

  const loadSecretValue = async (secretName) => {
    const response = await client.getSecret(secretName);
    if (!response || typeof response.value !== "string" || !response.value.trim()) {
      throw new Error(`Key Vault secret "${secretName}" is empty or missing a value.`);
    }
    return response.value;
  };

  try {
    for (const secret of secretSpec) {
      const { value, source } = await cache.getOrLoad(secret.secretName, loadSecretValue);
      process.env[secret.targetEnv] = value;
      fetched.push({
        targetEnv: secret.targetEnv,
        secretName: secret.secretName,
        source
      });
    }
  } catch (error) {
    if (!allowLocalFallback) {
      throw error;
    }
    // eslint-disable-next-line no-console
    console.warn(
      "Key Vault resolution failed; falling back to local env values. " +
        "Set KEY_VAULT_ALLOW_LOCAL_FALLBACK=false to enforce fail-fast."
    );
    // eslint-disable-next-line no-console
    console.warn(`Key Vault fallback reason: ${error.message}`);
    return {
      keyVaultEnabled: false,
      keyVaultUri: "",
      fetched: [],
      cache: null,
      refreshIntervalSeconds: 0,
      mode: "env_fallback"
    };
  }

  return {
    keyVaultEnabled: true,
    keyVaultUri,
    fetched,
    cache,
    refreshIntervalSeconds,
    client,
    mode: "key_vault"
  };
}

function startRefreshLoop(runtimeSecrets) {
  if (!runtimeSecrets?.keyVaultEnabled) {
    return null;
  }

  const intervalSeconds = runtimeSecrets.refreshIntervalSeconds || 0;
  if (intervalSeconds <= 0) {
    return null;
  }

  const interval = setInterval(async () => {
    try {
      for (const fetched of runtimeSecrets.fetched) {
        const response = await runtimeSecrets.client.getSecret(fetched.secretName);
        if (typeof response.value === "string" && response.value.trim()) {
          runtimeSecrets.cache.set(fetched.secretName, response.value);
          process.env[fetched.targetEnv] = response.value;
        }
      }
      // eslint-disable-next-line no-console
      console.log("Key Vault refresh completed. Restart service to guarantee all clients use updated secrets.");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Key Vault refresh failed:", error.message);
    }
  }, intervalSeconds * 1000);

  interval.unref?.();
  return interval;
}

async function loadRuntimeConfig() {
  const runtimeSecrets = await hydrateFromKeyVault();
  const config = buildConfigSnapshot();
  validateConfig(config, { keyVaultEnabled: runtimeSecrets.keyVaultEnabled });
  startRefreshLoop(runtimeSecrets);

  return {
    ...config,
    keyVault: {
      enabled: runtimeSecrets.keyVaultEnabled,
      uri: runtimeSecrets.keyVaultUri,
      fetched: runtimeSecrets.fetched,
      mode: runtimeSecrets.mode || "env"
    }
  };
}

module.exports = {
  loadRuntimeConfig
};
