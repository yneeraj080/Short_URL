const jwt=require("jsonwebtoken");

const auth=(req,res,next)=>{
    const authHeader=req.header("Authorization");
    if(!authHeader){
        return res.status(401).json({error: "No token, authorization denied"})
    }
    const token= authHeader.startsWith("Bearer")
    ? authHeader.slice(7)
    : authHeader;
    try{
        const decoded=jwt.verify(token, process.env.JWT_SECRET);
        req.user=decoded;
        next();
    }catch(error){
        res.status(401).json({error:"Token is not valid"});
    }
};
module.exports=auth;