const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get Settings: Accessible by everyone (POS needs it for receipts)
router.get('/', settingsController.getSettings);

// Update Settings: Accessible only by Admin
router.put('/', authorize('Admin'), settingsController.updateSettings);

// Change own password: Any authenticated user
router.post('/change-password', settingsController.changePassword);

// Print receipt via configured printer
router.post('/print-receipt', settingsController.printReceipt);

// Proxy print to Printer Agent on cashier PC
router.post('/print-via-agent', settingsController.printViaAgent);

// Print invoice/quotation to thermal printer
router.post('/print-thermal-document', settingsController.printThermalDocument);

// Check if printer exists for a purpose (receipt|invoice|quotation)
router.get('/printers/check', settingsController.checkPrinter);

// Printers CRUD: Admin only
router.get('/printers', settingsController.getPrinters);
router.post('/printers', authorize('Admin'), settingsController.createPrinter);
router.put('/printers/:id', authorize('Admin'), settingsController.updatePrinter);
router.delete('/printers/:id', authorize('Admin'), settingsController.deletePrinter);
router.post('/printers/:id/test', authorize('Admin'), settingsController.testPrinterById);

// Get categories for KOT printer mapping
router.get('/categories', settingsController.getCategories);

// Test printer connection (legacy): Admin only
router.post('/test-printer', authorize('Admin'), settingsController.testPrinter);

// System info: Admin only
router.get('/system-info', authorize('Admin'), settingsController.getSystemInfo);

module.exports = router;
