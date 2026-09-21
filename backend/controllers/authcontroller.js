const user = require("../models/User");
const bcrypt= require("bcryptjs");
const jwt= require("jsonwebtoken");
const User = require("../models/User");

const register=async(req,res)=>{
    const {name, email,password}=req.body;
    try{
        const existing = await User.findOne({email});
        if(existing){
            return res.status(400).json({error:"Email already registered"});
        }
        const salt= await bcrypt.genSalt(10);
        const hashedPassword=await bcrypt.hash(password,salt);

        const user=new User({name,email,password:hashedPassword});
        await user.save();

        const token= jwt.sign({id:user._id}, process.env.JWT_SECRET,{
            expiresIn:"7d"
        });
        res.status(201).json({
            token,
            user:{
                id:user._id,
                name:user.name,
                email:user.email,
            },
        });
    }catch(error){
        res.status(500).json({error: "Server error"});
    }
};
const login=async(req,res)=>{
    const {email, password}=req.body;
    try{
        const user=await User.findOne({email});
        if(!user){
            return res.status(400).json({error:"Invalid credentails"});
        }
        const isMatch= await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(400).json({error: "Invalid credentails"});
        }
        const token=jwt.sign({id: user._id}, process.env.JWT_SECRET,{
            expiresIn:"7d",
        });
        res.json({
            token,
            user:{
                id:user._id,
                name: user.name,
                email: user.email,
            },
        });
    }catch(error){
        res.status(500).json({error: "Server error"})
    }
};
module.exports ={ register, login};