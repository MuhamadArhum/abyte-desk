const express = require('express');
const router  = express.Router();
const { authenticate }    = require('../middleware/auth');
const tenantController    = require('../controllers/tenantController');

router.use(authenticate);

router.get('/stats',              tenantController.getStats);
router.get('/modules',            tenantController.getModules);
router.get('/activity',           tenantController.getActivity);
router.get('/revenue',            tenantController.getRevenue);
router.get('/recent-activity',    tenantController.getRecentActivity);
router.get('/expiring',           tenantController.getExpiring);
router.post('/bulk',              tenantController.bulkUpdate);
router.get('/',                   tenantController.getAll);
router.get('/:id',                tenantController.getOne);
router.get('/:id/activity',       tenantController.getTenantActivity);
router.get('/:id/details',        tenantController.getDetails);
router.post('/',                  tenantController.create);
router.put('/:id',                tenantController.update);
router.post('/:id/send-invoice-email', tenantController.sendInvoiceEmail);
router.post('/:id/reset-password',     tenantController.resetPassword);
router.post('/:id/renew',              tenantController.renew);
router.get('/:id/branches',            tenantController.getBranches);
router.post('/:id/branches',           tenantController.createBranch);
router.put('/:id/branches/:branchId',  tenantController.updateBranch);
router.delete('/:id/branches/:branchId', tenantController.deleteBranch);

router.get('/:id/users',               tenantController.getUsers);
router.post('/:id/users',              tenantController.createUser);
router.put('/:id/users/:userId',       tenantController.updateUser);
router.delete('/:id/users/:userId',    tenantController.deleteUser);

module.exports = router;
