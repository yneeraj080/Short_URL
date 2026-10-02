const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { register, login, changePassword } = require("../controllers/authController");
const auth = require("../middleware/auth");

router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  login
);

router.put("/change-password", auth, changePassword);

module.exports = router;