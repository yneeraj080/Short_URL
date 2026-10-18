
const ClickEvent = require("../models/ClickEvent");
const Url = require("../models/Url");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { validationResult } = require("express-validator");
const hotCache = require("../utils/hotCache");

// Safety cap on the click stream. Normally the analytics worker trims processed
// entries (see trimProcessedEntries), keeping the stream tiny. This cap only
// matters if the worker is down for a long time: beyond ~STREAM_MAXLEN unsaved
// clicks the oldest are dropped, instead of Redis running out of memory.
// STREAM_MAXLEN=0 disables the cap.
const STREAM_MAXLEN = Number(process.env.STREAM_MAXLEN ?? 1000000);
const STREAM_TRIM =
  STREAM_MAXLEN > 0
    ? { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: STREAM_MAXLEN } }
    : undefined;

// HTTP headers must be ASCII. new URL() percent-encodes anything else
// (e.g. https://example.com/café), which is what res.redirect() did for us.
const toLocationHeader = (originalUrl) => {
  try {
    return new URL(originalUrl).href;
  } catch {
    return encodeURI(originalUrl);
  }
};


const CODE_ALPHABET =
  "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

const generateShortCode = (size = 6) => {
  const bytes = crypto.randomBytes(size);
  let code = "";

  for (let i = 0; i < size; i++) {
    code += CODE_ALPHABET[bytes[i] & 63];
  }

  return code;
};

// Create a short URL for the authenticated user
const shortenUrl = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const { alias, expiresIn } = req.body;
  const originalUrl = /^https?:\/\//i.test(req.body.originalUrl)
    ? req.body.originalUrl
    : `https://${req.body.originalUrl}`;

  try {
    if (alias) {
      const existing = await Url.findOne({
        shortCode: alias,
      });

      if (existing) {
        return res.status(400).json({
          error: "Alias already taken",
        });
      }
    }

    const shortCode = alias || generateShortCode(6);

    const expiresAt = expiresIn
      ? new Date(
          Date.now() + expiresIn * 24 * 60 * 60 * 1000
        )
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const url = new Url({
      originalUrl,
      shortCode,
      expiresAt,
      userId: req.user.id,
    });

    await url.save();

    const shortUrl =
      `${req.protocol}://${req.get("host")}/${shortCode}`;

    return res.status(201).json({
      originalUrl,
      shortCode,
      shortUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("Error creating short URL:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        error: "Short code or alias already exists",
      });
    }

    return res.status(500).json({
      error: "Server error",
    });
  }
};

// Redirect a short URL and publish a click event to Redis
const redirectUrl = async (req, res) => {
  const { code } = req.params;
  const now = new Date();
  const redis = req.app.locals.redis;
  const cacheKey = `url:${code}`;

  try {
    // 1. In-process hot cache (a few seconds), then Redis, then MongoDB.
    let url = hotCache.get(code) || null;
    const fromMemory = Boolean(url);
    let cacheHit = fromMemory;

    if (!url) {
      try {
        const cached = await redis.get(cacheKey);

        if (cached) {
          url = JSON.parse(cached);
          cacheHit = true;
        }
      } catch (error) {
        console.error("Redis cache read failed:", error.message);
      }
    }
    if (!url) {
      const record = await Url.findOne({
        shortCode: code,
      })
        .select("_id originalUrl expiresAt")
        .lean();

      if (!record) {
        return res.status(404).json({
          error: "Short URL not found",
        });
      }

      url = {
        _id: String(record._id),
        originalUrl: record.originalUrl,
        location: toLocationHeader(record.originalUrl),
        expiresAt: record.expiresAt
          ? new Date(record.expiresAt).toISOString()
          : null,
      };
    }
    if (url.expiresAt && new Date(url.expiresAt) <= now) {
      hotCache.remove(code);
      await Url.deleteOne({ _id: url._id });

      try {
        await redis.del(cacheKey);
      } catch (error) {
        console.error("Redis cache deletion failed:", error.message);
      }

      return res.status(410).json({
        error: "Short URL has expired",
      });
    }
    if (!cacheHit) {
      try {
        await redis.set(cacheKey, JSON.stringify(url), {
          EX: 60,
        });
      } catch (error) {
        console.error("Redis cache write failed:", error.message);
      }
    }
    // Only store entries fetched from Redis/MongoDB. Refreshing on memory hits
    // would keep a deleted-but-popular link alive forever on this process.
    if (!fromMemory) {
      hotCache.set(code, url);
    }
    // Publish the raw user-agent; the analytics worker parses it into
    // browser/device/OS off the hot path (parsing was ~10% of redirect CPU).
    // Awaited on purpose: the 302 is only sent once Redis has the click, so a
    // crash can't lose clicks for redirects that already happened. (Manual
    // batching was tested in 1.5 and was slower; the Redis client already
    // pipelines concurrent commands.)
    try {
      await redis.xAdd(
        "url-click-events",
        "*",
        {
          urlId: String(url._id),
          clickedAt: now.toISOString(),
          ua: (req.headers["user-agent"] || "").slice(0, 512),
        },
        STREAM_TRIM
      );
    } catch (error) {
      console.error("Failed to publish click event:", error.message);
    }

    // Plain 302. res.redirect() also builds an HTML body and negotiates
    // content types, which a browser following a redirect never uses.
    res.writeHead(302, {
      Location: url.location || toLocationHeader(url.originalUrl),
      "Content-Length": 0,
    });
    return res.end();
  } catch (error) {
    console.error("Error redirecting short URL:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
};

// Look up the destination of a short URL
const lookupUrl = async (req, res) => {
  const { code } = req.params;

  try {
    const url = await Url.findOne({
      shortCode: code,
    });

    if (!url) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    if (url.expiresAt && url.expiresAt <= new Date()) {
      return res.status(410).json({
        error: "Short URL has expired",
      });
    }

    return res.json({
      originalUrl: url.originalUrl,
    });
  } catch (error) {
    console.error("Error looking up short URL:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
};

// Get analytics for a URL owned by the authenticated user
const getStats = async (req, res) => {
  const { code } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const url = await Url.findOne({
      shortCode: code,
      userId: req.user.id,
    })
      .select(
        "originalUrl shortCode clicks createdAt expiresAt analytics"
      )
      .lean();

    if (!url) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }
    const [newClickCount, recentEvents] = await Promise.all([
      ClickEvent.countDocuments({
        urlId: url._id,
      }),

      ClickEvent.find({
        urlId: url._id,
      })
        .sort({ clickedAt: -1 })
        .limit(1000)
        .select("clickedAt browser device os")
        .lean(),
    ]);
    const oldAnalytics = (url.analytics || []).map((event) => ({
      _id: event._id,
      clickedAt: event.clickedAt,
      browser: event.browser || "Unknown",
      device: event.device || "Desktop",
      os: event.os || "Unknown",
    }));
    const newAnalytics = recentEvents.map((event) => ({
      _id: event._id,
      clickedAt: event.clickedAt,
      browser: event.browser || "Unknown",
      device: event.device || "Desktop",
      os: event.os || "Unknown",
    }));
    const analytics = [...oldAnalytics, ...newAnalytics]
      .sort(
        (a, b) =>
          new Date(a.clickedAt).getTime() -
          new Date(b.clickedAt).getTime()
      )
      .slice(-1000);

    return res.json({
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      clicks: (url.clicks || 0) + newClickCount,

      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
      analytics,
    });
  } catch (error) {
    console.error("Error fetching URL statistics:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
};

// Generate a QR code for the authenticated user's short URL
const getQRCode = async (req, res) => {
  const { code } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const url = await Url.findOne({
      shortCode: code,
      userId: req.user.id,
    });

    if (!url) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    const shortUrl =
      `${req.protocol}://${req.get("host")}/${code}`;

    const qr = await QRCode.toDataURL(shortUrl);

    return res.json({ qr });
  } catch (error) {
    console.error("Error generating short URL QR code:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
};

// Generate a QR code for the original URL
const getOriginalQRCode = async (req, res) => {
  const { code } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const url = await Url.findOne({
      shortCode: code,
      userId: req.user.id,
    });

    if (!url) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    const qr = await QRCode.toDataURL(url.originalUrl);

    return res.json({ qr });
  } catch (error) {
    console.error(
      "Error generating original URL QR code:",
      error
    );

    return res.status(500).json({
      error: "Server error",
    });
  }
};

// Get URLs belonging to the authenticated user
const getUserUrls = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const urls = await Url.find({
      userId: req.user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (urls.length === 0) {
      return res.json([]);
    }
    const urlIds = urls.map((url) => url._id);

    const clickCounts = await ClickEvent.aggregate([
      {
        $match: {
          urlId: { $in: urlIds },
        },
      },
      {
        $group: {
          _id: "$urlId",
          count: { $sum: 1 },
        },
      },
    ]);

    const clickCountMap = new Map(
      clickCounts.map((item) => [
        String(item._id),
        item.count,
      ])
    );
    const result = urls.map((url) => ({
      ...url,
      clicks:
        (url.clicks || 0) +
        (clickCountMap.get(String(url._id)) || 0),
    }));

    return res.json(result);
  } catch (error) {
    console.error("Error fetching user URLs:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
};

// Delete a URL only if it belongs to the authenticated user
const deleteUrl = async (req, res) => {
  const { code } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const deletedUrl = await Url.findOneAndDelete({
      shortCode: code,
      userId: req.user.id,
    });

    if (!deletedUrl) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    await ClickEvent.deleteMany({ urlId: deletedUrl._id });
    // This process forgets it now; other API processes within HOT_CACHE_TTL_MS.
    hotCache.remove(code);
    try {
      const redis = req.app.locals.redis;

      if (redis && redis.isOpen) {
        await redis.del(`url:${code}`);
      }
    } catch (error) {
      console.error(
        "Redis cache invalidation failed:",
        error.message
      );
    }

    return res.json({
      message: "URL deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting URL:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
};

module.exports = {
  shortenUrl,
  redirectUrl,
  lookupUrl,
  getStats,
  getQRCode,
  getOriginalQRCode,
  getUserUrls,
  deleteUrl,
};
