const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const authController  = require('../controllers/authController');

router.post('/login',            authController.login);
router.post('/forgot-password',  authController.forgotPassword);
router.post('/reset-password',   authController.resetPassword);
router.get('/me',                authenticate, authController.me);
router.get('/admins',            authenticate, authController.getAdmins);
router.put('/profile',           authenticate, authController.updateProfile);
router.post('/change-password',  authenticate, authController.changePassword);

module.exports = router;
