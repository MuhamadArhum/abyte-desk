const express = require('express');
const router = express.Router();
const controller = require('../controllers/salesReportController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);
router.use(requirePermission('sales.reports'));

router.get('/summary', controller.getSalesSummary);
router.get('/hourly', controller.getHourlySales);
router.get('/payment-breakdown', controller.getPaymentBreakdown);
router.get('/cashier-performance', controller.getCashierPerformance);
router.get('/daily-trend', controller.getDailyTrend);
router.get('/top-customers', controller.getTopCustomers);
router.get('/comparison', controller.getSalesComparison);
router.get('/category-breakdown', controller.getCategoryBreakdown);

module.exports = router;
