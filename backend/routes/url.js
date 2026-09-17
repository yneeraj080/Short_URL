const exprees = require("express");
const router=exprees.Router();
const {body} = require("express-validator");
const{
    shortenUrl,
    redirectUrl,
    lookupUrl,
    getStats,
    getQRCode,
    getOriginalQRCode,
}=require("../controllers/urlController");

router.post("/shorten",[
    body("originalUrl")
        .isURL()
        .withMessage("please provide a valid URL"),
    body("alias")
        .optional()
        .isAlphanumeric()
        .withMessage("Alias must be alphanumeric")
        .isLength({min:3, max:20})
        .withMessage("Alias must br between 3 and 20 characters")
], shortenUrl);

router.get("/lookup/:code",lookupUrl);

router.get("/stats/:code",getStats);

router.get("/qr/:code", getQRCode);

router.get("/qr/original/:code",getOriginalQRCode);


module.exports=router;