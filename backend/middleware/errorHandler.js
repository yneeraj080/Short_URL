const errorHandler=(err,req,res,next)=>{
    const statusCode=err.statusCode || 500;
    const messsage= err.messsage || "Internal Server Error";

    res.status(statusCode).json({
    success: false,
    statusCode,
    messsage,
    });
};

module.exports=errorHandler;