const mongoose = require('mongoose');

/**
 * Cached connection reference — persists across warm serverless invocations.
 * @type {{ conn: mongoose.Connection | null, promise: Promise<typeof mongoose> | null }}
 */
let cached = global.__mongooseCache;
if (!cached) {
    cached = global.__mongooseCache = { conn: null, promise: null };
}

/** MongoDB connection options tuned for serverless. */
const CONNECTION_OPTIONS = {
    bufferCommands: false,
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    heartbeatFrequencyMS: 30_000,
    retryWrites: true,
    retryReads: true,
};

/** Maximum number of connection attempts before giving up. */
const MAX_RETRIES = 3;

/** Base delay (ms) between retries — doubled on each attempt. */
const BASE_RETRY_DELAY_MS = 1_000;

/**
 * Connect to MongoDB with retry logic.
 * Re-uses an existing connection when the serverless instance is still warm.
 *
 * @returns {Promise<typeof mongoose>} The mongoose instance.
 * @throws {Error} If MONGODB_URI is missing or connection fails after retries.
 */
async function dbConnect() {
    // Return warm connection immediately
    if (cached.conn) {
        return cached.conn;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error(
            'MONGODB_URI environment variable is not set. ' +
            'Add it to your .env file (local) or the Vercel dashboard (production).'
        );
    }

    if (!cached.promise) {
        cached.promise = connectWithRetry(uri);
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        // Reset so the next invocation tries a fresh connection
        cached.promise = null;
        throw error;
    }

    return cached.conn;
}

/**
 * Attempt to connect up to MAX_RETRIES times with exponential backoff.
 *
 * @param {string} uri - MongoDB connection string.
 * @returns {Promise<typeof mongoose>}
 */
async function connectWithRetry(uri) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const connection = await mongoose.connect(uri, CONNECTION_OPTIONS);
            console.log(`✅ MongoDB connected (attempt ${attempt})`);
            return connection;
        } catch (error) {
            lastError = error;
            console.error(
                `❌ MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`
            );

            if (attempt < MAX_RETRIES) {
                const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error(
        `Failed to connect to MongoDB after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`
    );
}

module.exports = dbConnect;
