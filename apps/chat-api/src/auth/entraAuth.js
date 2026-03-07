const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

function buildVerifierConfig() {
  const tenantId = process.env.ENTRA_TENANT_ID || "";
  const explicitIssuer = process.env.ENTRA_ISSUER || "";
  const defaultIssuers = tenantId
    ? [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`
      ]
    : [];
  const issuers = explicitIssuer ? [explicitIssuer] : defaultIssuers;
  const audience = process.env.ENTRA_AUDIENCE || "";
  const jwksUri =
    process.env.ENTRA_JWKS_URI ||
    (tenantId
      ? `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
      : "");

  return { tenantId, issuers, audience, jwksUri };
}

let verifierContext = null;
let verifierContextKey = "";

function getVerifierContext() {
  const config = buildVerifierConfig();
  const contextKey = JSON.stringify(config);
  if (verifierContext && verifierContextKey === contextKey) {
    return verifierContext;
  }

  verifierContextKey = contextKey;
  verifierContext = {
    config,
    client: jwksClient({
      jwksUri: config.jwksUri,
      cache: true,
      cacheMaxEntries: 10,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10
    })
  };
  return verifierContext;
}

function getSigningKey(client, header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, key.getPublicKey());
  });
}

function normalizeClaims(claims) {
  return {
    oid: claims.oid,
    tid: claims.tid,
    name: claims.name || claims.preferred_username || claims.upn || claims.oid,
    preferredUsername: claims.preferred_username || claims.upn || "",
    roles: Array.isArray(claims.roles) ? claims.roles : []
  };
}

function verifyAccessToken(token) {
  const context = getVerifierContext();
  const verifierConfig = context.config;

  if (!verifierConfig.tenantId || !verifierConfig.audience || verifierConfig.issuers.length === 0) {
    throw new Error("Entra validation not configured. Set ENTRA_TENANT_ID and ENTRA_AUDIENCE.");
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => getSigningKey(context.client, header, callback),
      {
        algorithms: ["RS256"],
        issuer: verifierConfig.issuers,
        audience: verifierConfig.audience
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }

        if (!decoded?.oid) {
          reject(new Error("Token is missing oid claim."));
          return;
        }

        if (decoded.tid !== verifierConfig.tenantId) {
          reject(new Error("Token tenant mismatch."));
          return;
        }

        resolve(normalizeClaims(decoded));
      }
    );
  });
}

async function authenticateExpress(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || "").trim();
    const [scheme, ...rest] = authHeader.split(/\s+/);
    const token = rest.join(" ").trim();
    if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
      res.status(401).json({ ok: false, error: "Missing or malformed bearer token." });
      return;
    }

    req.auth = await verifyAccessToken(token);
    next();
  } catch (error) {
    res.status(401).json({ ok: false, error: "Invalid bearer token." });
  }
}

async function authenticateSocket(socket, next) {
  try {
    const token = String(socket.handshake.auth?.token || "").trim();
    if (!token) {
      next(new Error("Missing bearer token."));
      return;
    }
    socket.data.auth = await verifyAccessToken(token);
    next();
  } catch (_error) {
    next(new Error("Invalid bearer token."));
  }
}

module.exports = {
  verifyAccessToken,
  authenticateExpress,
  authenticateSocket
};
