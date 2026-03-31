/**
 * Bearer token auth middleware.
 * Reuses WS_AUTH_TOKEN env var. If not set, auth is disabled (dev mode).
 */

import type { Request, Response, NextFunction } from "express";

const AUTH_TOKEN = process.env.WS_AUTH_TOKEN ?? "";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If no token configured, auth is disabled (dev mode)
  if (!AUTH_TOKEN) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== AUTH_TOKEN) {
    res.status(403).json({ error: "Invalid token" });
    return;
  }

  next();
}
