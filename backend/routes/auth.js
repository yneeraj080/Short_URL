const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { register, login, changePassword } = require("../controllers/authController");
const auth = require("../middleware/auth");

router.post(
  "/register",
  [
    body("name")
      .isString()
      .withMessage("Name is required")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("Name is required"),
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password")
      .isString()
      .withMessage("Password must be at least 6 characters")
      .bail()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password")
      .isString()
      .withMessage("Password is required")
      .bail()
      .notEmpty()
      .withMessage("Password is required"),
  ],
  login
);

router.put(
  "/change-password",
  auth,
  [
    body("currentPassword")
      .isString()
      .withMessage("Current password is required")
      .bail()
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isString()
      .withMessage("New password must be at least 6 characters")
      .bail()
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  changePassword
);

module.exports = router;