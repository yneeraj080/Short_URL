
const ClickEvent = require("../models/ClickEvent");
const Url = require("../models/Url");
const { nanoid } = require("nanoid");
const QRCode = require("qrcode");
const { validationResult } = require("express-validator");
const UAParser = require("ua-parser-js");

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

  const { originalUrl, alias, expiresIn } = req.body;

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

    const shortCode = alias || nanoid(6);

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
    let url = null;

    // 1. Try Redis cache first
    try {
      const cached = await redis.get(cacheKey);

      if (cached) {
        url = JSON.parse(cached);
      }
    } catch (error) {
      console.error("Redis cache read failed:", error.message);
    }

    // 2. Read MongoDB when the cache misses
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
        expiresAt: record.expiresAt
          ? new Date(record.expiresAt).toISOString()
          : null,
      };
    }

    // 3. Check expiration, including cached URLs
    if (url.expiresAt && new Date(url.expiresAt) <= now) {
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

    // 4. Cache the destination for 60 seconds
    try {
      await redis.set(cacheKey, JSON.stringify(url), {
        EX: 60,
      });
    } catch (error) {
      console.error("Redis cache write failed:", error.message);
    }

    // 5. Extract basic click information
    const parser = new UAParser(req.headers["user-agent"]);

    const browser = parser.getBrowser().name || "Unknown";
    const device = parser.getDevice().type || "Desktop";
    const os = parser.getOS().name || "Unknown";

    // 6. Publish the click event for the analytics worker
    try {
      await redis.xAdd("url-click-events", "*", {
        urlId: String(url._id),
        clickedAt: now.toISOString(),
        browser,
        device,
        os,
      });
    } catch (error) {
      // Keep the redirect available if analytics publishing fails.
      console.error("Failed to publish click event:", error.message);
    }

    // 7. Redirect without waiting for MongoDB analytics writes
    return res.redirect(url.originalUrl);
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

    // Read the new click count and recent events concurrently.
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

    // Preserve analytics from the old URL document.
    const oldAnalytics = (url.analytics || []).map((event) => ({
      _id: event._id,
      clickedAt: event.clickedAt,
      browser: event.browser || "Unknown",
      device: event.device || "Desktop",
      os: event.os || "Unknown",
    }));

    // Convert the new ClickEvent documents.
    const newAnalytics = recentEvents.map((event) => ({
      _id: event._id,
      clickedAt: event.clickedAt,
      browser: event.browser || "Unknown",
      device: event.device || "Desktop",
      os: event.os || "Unknown",
    }));

    // Merge both sources and return at most 1,000 recent records.
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

      // Legacy total plus events in the new collection.
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

    // Count new analytics events for all these URLs in one query.
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

    // Combine legacy totals with newly stored click events.
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

    // Invalidate the cached destination after deletion.
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
