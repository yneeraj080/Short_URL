const express = require("express");
const router=express.Router();
const {body} = require("express-validator");
const auth = require("../middleware/auth")
const{
    shortenUrl,
    redirectUrl,
    lookupUrl,
    getStats,
    getQRCode,
    getOriginalQRCode,
    getUserUrls,
    deleteUrl,
}=require("../controllers/urlController");

router.post("/shorten",auth,[
    body("originalUrl")
        .isString()
        .trim()
        .isURL({ protocols: ["http", "https"] })
        .withMessage("please provide a valid URL"),
    body("alias")
        .optional()
        .isAlphanumeric()
        .withMessage("Alias must be alphanumeric")
        .isLength({min:3, max:20})
        .withMessage("Alias must be between 3 and 20 characters"),
    body("expiresIn")
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage("Expiry must be between 1 and 365 days")
        .toInt(),
], shortenUrl);

router.get("/urls",auth,getUserUrls);

router.delete("/urls/:code",auth,deleteUrl);

router.get("/lookup/:code",lookupUrl);

router.get("/stats/:code", auth, getStats);

router.get("/qr/:code", auth, getQRCode);

router.get("/qr/original/:code", auth, getOriginalQRCode);


module.exports=router;