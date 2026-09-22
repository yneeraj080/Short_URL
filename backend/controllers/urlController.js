const Url = require("../models/Url");
const { nanoid } = require("nanoid");
const QRCode = require("qrcode");
const { validationResult } = require("express-validator");
const UAParser = require("ua-parser-js");

const shortenUrl = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { originalUrl, alias, expiresIn } = req.body;
  try {
    if (alias) {
      const existing = await Url.findOne({ shortCode: alias });
      if (existing) {
        return res.status(400).json({ error: "Alias already taken" });
      }
    }
    const shortCode = alias || nanoid(6);
    // set the expiry date
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const url = new Url({ originalUrl, shortCode, expiresAt });
    await url.save();
    res.status(201).json({
      originalUrl,
      shortCode,
      shortUrl: `http://localhost:5000/${shortCode}`,
      expiresAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const redirectUrl = async (req, res) => {
  const { code } = req.params;
  try {
    const url = await Url.findOne({ shortCode: code });
    if (!url) {
      return res.status(404).json({ error: "Short URL not found" });
    }
    // check if Url is expired
    if (url.expiresAt < new Date()) {
      await Url.deleteOne({ short: code });
      return res.status(410).json({ error: "Short URL has expired" });
    }
    // Parse user agent
    const parser = new UAParser(req.headers["user-agent"]);
    const browser = parser.getBrowser().name || "Unknown";
    const device = parser.getDevice().type || "Desktop";
    const os = parser.getOS().name || "Unknown";
    // count clicks
    url.clicks++;
    url.analytics.push({ clickedAt: new Date(), browser, device, os });
    await url.save();
    res.redirect(url.originalUrl);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error" });
  }
};

const lookupUrl = async (req, res) => {
  const { code } = req.params;
  try {
    const url = await Url.findOne({ shortCode: code });
    if (!url) {
      return res.status(404).json({ error: "Short URl not found" });
    }
    res.json({ originalUrl: url.originalUrl });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const getStats = async (req, res) => {
  const { code } = req.params;
  try {
    const url = await Url.findOne({ shortCode: code });
    if (!url) {
      return res.status(404).json({ error: "Short URL not found" });
    }
    res.json({
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      clicks: url.clicks,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
      analytics: url.analytics,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const getQRCode = async (req, res) => {
  const { code } = req.params;
  try {
    const url = await Url.findOne({ shortCode: code });
    if (!url) {
      return res.status(404).json({ error: "Short Url not found" });
    }
    const shortUrl = `http://localhost:5000/${code}`;
    const qr = await QRCode.toDataURL(shortUrl);
    res.json({ qr });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const getOriginalQRCode = async (req, res) => {
  const { code } = req.params;
  try {
    const url = await Url.findOne({ shortCode: code });
    if (!url) {
      return res.status(404).json({ error: "Short URL not fount" });
    }
    const qr = await QRCode.toDataURL(url.originalUrl);
    res.json({ qr });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  shortenUrl,
  redirectUrl,
  lookupUrl,
  getStats,
  getQRCode,
  getOriginalQRCode,
};
