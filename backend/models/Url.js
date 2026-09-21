const mongoose=require("mongoose");

const urlSchema=new mongoose.Schema({
    originalUrl:{
        type:String,
        required: true,
    },
    shortCode:{
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    clicks:{
        type:Number,
        default:0,
    },
    expiresAt:{
        type: Date,
        default: ()=> new Date(Date.now()+ 30*24*60*60*1000),
    },
    createdAt:{
        type: Date,
        default: Date.now,
    },
});
module.exports=mongoose.model("Url",urlSchema);