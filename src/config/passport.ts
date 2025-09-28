import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';

// Only initialize Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL:
          process.env.BACKEND_URL + '/api/auth/google/callback' ||
          'http://localhost:3001/api/auth/google/callback',
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create user
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

        // Check if email exists
        user = await User.findOne({ email: profile.emails?.[0]?.value });

        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id;
          user.avatar = profile.photos?.[0]?.value || user.avatar;
          await user.save();
          return done(null, user);
        }

        // Create new user
        const newUser = await User.create({
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName || 'User',
          avatar: profile.photos?.[0]?.value || '',
          googleId: profile.id,
        });

        return done(null, newUser);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
    )
  );
} else {
  console.warn('⚠️  Google OAuth credentials not found. OAuth authentication will be disabled.');
}

passport.serializeUser((user: any, done) => {
  done(null, user._id.toString());
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
