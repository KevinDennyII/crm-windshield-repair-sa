import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { authStorage } from "./storage";
import { Strategy as OpenIDConnectStrategy, type Profile } from "passport-openidconnect";
import { db } from "../../db";
import { sessions } from "@shared/schema";
import { eq } from "drizzle-orm";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

function getSession() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }

  return session({
    store: new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const issuerUrl = process.env.ISSUER_URL || "https://replit.com/oidc";
  const callbackUrl = "/api/callback";

  passport.use(
    new OpenIDConnectStrategy(
      {
        issuer: issuerUrl,
        authorizationURL: `${issuerUrl}/auth`,
        tokenURL: `${issuerUrl}/token`,
        userInfoURL: `${issuerUrl}/userinfo`,
        clientID: process.env.REPLIT_DEPLOYMENT_ID || "local-dev",
        clientSecret: process.env.REPLIT_DEPLOYMENT_ID || "local-dev",
        callbackURL: callbackUrl,
        scope: "openid profile email",
      },
      async (
        _issuer: string,
        profile: Profile,
        _context: object,
        _idToken: string,
        _accessToken: string,
        _refreshToken: string,
        done: (err: Error | null, user?: Express.User) => void
      ) => {
        try {
          const user = await authStorage.upsertUser({
            id: profile.id,
            email: profile.emails?.[0]?.value || null,
            firstName: profile.name?.givenName || null,
            lastName: profile.name?.familyName || null,
            profileImageUrl: profile.photos?.[0]?.value || null,
          });
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as any).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await authStorage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.get("/api/login", passport.authenticate("openidconnect"));

  app.get(
    callbackUrl,
    passport.authenticate("openidconnect", {
      failureRedirect: "/",
      successRedirect: "/",
    })
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
