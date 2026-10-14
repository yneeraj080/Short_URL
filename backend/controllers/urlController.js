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
    return res.status(401).json({ error: "Authentication required" });
  }

  const { originalUrl, alias, expiresIn } = req.body;

  try {
    // Check whether the custom alias is already taken
    if (alias) {
      const existing = await Url.findOne({ shortCode: alias });

      if (existing) {
        return res.status(400).json({ error: "Alias already taken" });
      }
    }

    const shortCode = alias || nanoid(6);

    // Set expiration date
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // IMPORTANT: Associate the URL with its creator
    const url = new Url({
      originalUrl,
      shortCode,
      expiresAt,
      userId: req.user.id,
    });

    await url.save();

    const shortUrl = `${req.protocol}://${req.get("host")}/${shortCode}`;

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

    return res.status(500).json({ error: "Server error" });
  }
};

// Redirect a short URL to its original destination
const redirectUrl = async (req, res) => {
  const { code } = req.params;

  try {
    // Redirects remain public
    const url = await Url.findOne({ shortCode: code });

    if (!url) {
      return res.status(404).json({ error: "Short URL not found" });
    }

    // Check expiration
    if (url.expiresAt && url.expiresAt < new Date()) {
      await Url.deleteOne({ shortCode: code });

      return res.status(410).json({
        error: "Short URL has expired",
      });
    }

    // Parse user agent
    const parser = new UAParser(req.headers["user-agent"]);
    const browser = parser.getBrowser().name || "Unknown";
    const device = parser.getDevice().type || "Desktop";
    const os = parser.getOS().name || "Unknown";

    // Update click analytics
    url.clicks = (url.clicks || 0) + 1;

    url.analytics.push({
      clickedAt: new Date(),
      browser,
      device,
      os,
    });

    await url.save();

    return res.redirect(url.originalUrl);
  } catch (error) {
    console.error("Error redirecting short URL:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Look up the destination of a public short URL
const lookupUrl = async (req, res) => {
  const { code } = req.params;

  try {
    const url = await Url.findOne({ shortCode: code });

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
    return res.status(500).json({ error: "Server error" });
  }
};

// Get analytics for a URL owned by the authenticated user
const getStats = async (req, res) => {
  const { code } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    // Check ownership as well as the short code
    const url = await Url.findOne({
      shortCode: code,
      userId: req.user.id,
    });

    if (!url) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    return res.json({
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      clicks: url.clicks,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
      analytics: url.analytics,
    });
  } catch (error) {
    console.error("Error fetching URL statistics:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Generate a QR code for the authenticated user's short URL
const getQRCode = async (req, res) => {
  const { code } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
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

    const shortUrl = `${req.protocol}://${req.get("host")}/${code}`;
    const qr = await QRCode.toDataURL(shortUrl);

    return res.json({ qr });
  } catch (error) {
    console.error("Error generating short URL QR code:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Generate a QR code for the original URL
const getOriginalQRCode = async (req, res) => {
  const { code } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
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
    console.error("Error generating original URL QR code:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Get URLs belonging ONLY to the authenticated user
const getUserUrls = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const urls = await Url.find({
      userId: req.user.id,
    }).sort({ createdAt: -1 });

    return res.json(urls);
  } catch (error) {
    console.error("Error fetching user URLs:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Delete a URL only if it belongs to the authenticated user
const deleteUrl = async (req, res) => {
  const { code } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
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

    return res.json({
      message: "URL deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting URL:", error);
    return res.status(500).json({ error: "Server error" });
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
