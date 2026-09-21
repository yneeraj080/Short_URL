const express= require("express");
const router=express.Router();
const{body}=require("express-validator");
const { register, login } = require("../controllers/authcontroller");

router.post(
    "/register",
    [
        body("name").notEmpty().withMessage("Name is required"),
        body("email").isEmail().withMessage("Please provide a valid email"),
        body("password")
            .isLength({min:6})
            .withMessage("Password must be at least 6 characters"),
    ],
    register
);
router.post(
    "/login",
    [
        body("email").isEmail().withMessage("Please provide a valid email"),
        body("password").notEmpty().withMessage("password is required"),
    ],
    login
);
module.exports = router;