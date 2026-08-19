import jwt from "jsonwebtoken";

// En dev, valeur par défaut pour ne pas bloquer `tsx watch` sans .env — en production, Railway
// doit fournir un vrai secret (voir Railway variables, généré au déploiement de l'auth).
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-insecure-secret";

if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET === undefined) {
  throw new Error("JWT_SECRET manquant en production");
}

export function signAuthToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string): { userId: string } {
  const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  if (typeof payload.sub !== "string") throw new Error("Token invalide");
  return { userId: payload.sub };
}
