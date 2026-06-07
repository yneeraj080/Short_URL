const Url=require("../models/Url");
const {nanoid}= require("nanoid");
const QRCode=require("qrcode");

const shortenUrl=async(req, res)=>{
    const {originalUrl, alias}= req.body;
    try{
        if(alias){
            const existing=await Url.findOne({shortCode:alias});
            if(existing){
                return res.status(400).json({error:"Alias already taken"});
            }
        }
        const shortCode= alias || nanoid(6);
        const url= new Url({originalUrl, shortCode});
        await url.save();
        res.status(201).json({
            originalUrl,
            shortCode,
            shortUrl: `http://localhost:5000/${shortCode}`,
        });
    }catch(error){
        res.status(500).json({error:"Server error"});
    }
};

const redirectUrl =async (req,res)=>{
    const {code}=req.params;
    try{
        const url=await Url.findOne({shortCode:code});
        if(!url){
            return res.status(404).json({error:"Short URL not found"});
        }
        url.clicks++;
        await url.save();
        res.redirect(url.originalUrl);
    }catch(error){
        res.status(500).json({error: "Server error"});
    }
};

const lookupUrl=async(req,res)=>{
    const {code}=req.params;
    try{
        const url=await Url.findOne({shortCode:code});
        if(!url){
            return res.status(404).json({error:"Short URl not found"});
        }
        res.json({originalUrl: url.originalUrl});
    }catch(error){
        res.status(500).json({error: "Server error"});
    }
};

const getStats=async(req,res)=>{
    const {code} =req.params;
    try{
        const url=await Url.findOne({shortCode: code});
        if(!url){
            return res.status(404).json({error: "Short URL not found"});
        }
        res.json({
            originalUrl: url.originalUrl,
            shortCode: url.shortCode,
            clicks: url.clicks,
            createdAt:url.createdAt,
        });
    }catch(error){
        res.status(500).json({error: "Server error"});
    }
};

const getQRCode=async(req,res)=>{
    const {code}=req.params;
    try{
        const url=await Url.findOne({shortCode:code});
        if(!url){
            return res.status(404).json({error:"Short Url not found"})
        }
        const shortUrl=`http://localhost:5000/${code}`;
        const qr=await QRCode.toDataURL(shortUrl);
        res.json({qr});
    } catch(error){
        res.status(500).json({error:"Server error"});
    }
}

const getOriginalQRCode=async(req,res)=>{
    const{code}=req.params;
    try{
        const url=await Url.findOne({shortCode:code});
        if(!url){
            return res.status(404).json({error : "Short URL not fount"})
        }
        const qr=await QRCode.toDataURL(url.originalUrl);
        res.json({qr});
    }catch(error){
        res.status(500).json({error:"Server error"});
    }
};

module.exports={shortenUrl,redirectUrl,lookupUrl, getStats, getQRCode, getOriginalQRCode};