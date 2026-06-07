const exprees = require("express");
const router=exprees.Router();
const{
    shortenUrl,
    redirectUrl,
    lookupUrl,
    getStats,
    getQRCode,
    getOriginalQRCode,
}=require("../controllers/urlController");

router.post("/shorten", shortenUrl);

router.get("/lookup/:code",lookupUrl);

router.get("/stats/:code",getStats);

router.get("/qr/:code", getQRCode);

router.get("/qr/original/:code",getOriginalQRCode);


module.exports=router;