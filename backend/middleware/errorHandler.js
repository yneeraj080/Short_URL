const errorHandler=(err,req,res,next)=>{
    const statusCode=err.statusCode || 500;
    // Only expose messages for errors that set an explicit client status.
    const message= (statusCode < 500 && err.message) || "Internal Server Error";

    if(statusCode >= 500){
        console.error(err);
    }

    res.status(statusCode).json({
    success: false,
    statusCode,
    error: message,
    });
};

module.exports=errorHandler;