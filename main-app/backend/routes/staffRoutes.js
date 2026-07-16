const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule }                   = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('hr'));

router.get('/reports/attendance-monthly', staffController.getMonthlyAttendanceReport);
router.get('/reports/salary-summary', staffController.getSalarySummaryReport);
router.get('/reports/salary-sheet', staffController.getSalarySheet);
router.post('/reports/salary-adjustment', requirePermission('hr.payroll'), staffController.setSalaryAdjustment);
router.get('/reports/salary-voucher', staffController.getSalaryVoucher);
router.get('/reports/daily-attendance', staffController.getDailyAttendance);
router.get('/reports/employee-ledger/:staffId', staffController.getEmployeeLedger);
router.get('/reports/leave-report', staffController.getLeaveReport);
router.get('/reports/overtime', staffController.getOvertimeReport);
router.get('/reports/loan-summary', staffController.getLoanSummary);
router.get('/reports/advance-summary', staffController.getAdvanceSummary);

router.get('/payroll/preview', requirePermission('hr.payroll'), staffController.getPayrollPreview);
router.post('/payroll/process', requirePermission('hr.payroll'), staffController.processPayroll);

router.get('/advance-payments', staffController.getAdvancePayments);
router.post('/advance-payments', requirePermission('hr.payroll'), staffController.createAdvancePayment);

router.get('/holidays', staffController.getHolidays);
router.post('/holidays', requirePermission('hr.holidays'), staffController.createHoliday);
router.put('/holidays/:id', requirePermission('hr.holidays'), staffController.updateHoliday);
router.delete('/holidays/:id', requirePermission('hr.holidays'), staffController.deleteHoliday);

router.get('/leave-requests', staffController.getLeaveRequests);
router.post('/leave-requests', requirePermission('hr.leaves'), staffController.createLeaveRequest);
router.put('/leave-requests/:id/review', requirePermission('hr.leaves'), staffController.reviewLeaveRequest);

router.get('/loans', staffController.getLoans);
router.post('/loans', requirePermission('hr.payroll'), staffController.createLoan);
router.get('/loans/:loanId/repayments', staffController.getLoanRepayments);
router.post('/loans/:loanId/repay', requirePermission('hr.payroll'), staffController.repayLoan);
router.put('/loans/:loanId/cancel', requirePermission('hr.payroll'), staffController.cancelLoan);

router.get('/increments', staffController.getIncrements);
router.post('/increments', requirePermission('hr.payroll'), staffController.createIncrement);

router.get('/attendance', staffController.getAttendance);
router.post('/attendance', requirePermission('hr.attendance'), staffController.markAttendance);
router.post('/attendance/bulk', requirePermission('hr.attendance'), staffController.markBulkAttendance);
router.put('/attendance/:id', requirePermission('hr.attendance'), staffController.updateAttendance);
router.delete('/attendance/:id', requirePermission('hr.attendance'), staffController.deleteAttendance);

router.put('/salary-payment/:id', requirePermission('hr.payroll'), staffController.updateSalaryPayment);
router.delete('/salary-payment/:id', requirePermission('hr.payroll'), staffController.deleteSalaryPayment);

router.get('/departments', staffController.getDepartments);
router.post('/departments', requirePermission('hr.departments'), staffController.createDepartment);
router.put('/departments/:id', requirePermission('hr.departments'), staffController.updateDepartment);
router.delete('/departments/:id', requirePermission('hr.departments'), staffController.deleteDepartment);

router.get('/designations', staffController.getDesignations);
router.post('/designations', requirePermission('hr.staff'), staffController.createDesignation);
router.put('/designations/:id', requirePermission('hr.staff'), staffController.updateDesignation);
router.delete('/designations/:id', requirePermission('hr.staff'), staffController.deleteDesignation);

router.get('/salary-components', staffController.getSalaryComponents);
router.post('/salary-components', requirePermission('hr.salary-components'), staffController.createSalaryComponent);
router.put('/salary-components/:id', requirePermission('hr.salary-components'), staffController.updateSalaryComponent);
router.delete('/salary-components/:id', requirePermission('hr.salary-components'), staffController.deleteSalaryComponent);

router.get('/staff-components/:staffId', staffController.getStaffComponents);
router.post('/staff-components/:staffId', requirePermission('hr.payroll'), staffController.saveStaffComponents);

router.get('/shifts', staffController.getShifts);
router.post('/shifts', requirePermission('hr.staff'), staffController.createShift);
router.put('/shifts/:id', requirePermission('hr.staff'), staffController.updateShift);
router.delete('/shifts/:id', requirePermission('hr.staff'), staffController.deleteShift);

router.get('/appraisals', staffController.getAppraisals);
router.post('/appraisals', requirePermission('hr.appraisals'), staffController.createAppraisal);
router.put('/appraisals/:id', requirePermission('hr.appraisals'), staffController.updateAppraisal);
router.delete('/appraisals/:id', requirePermission('hr.appraisals'), staffController.deleteAppraisal);

router.get('/exit-requests', staffController.getExitRequests);
router.post('/exit-requests', requirePermission('hr.exit'), staffController.createExitRequest);
router.put('/exit-requests/:id/review', requirePermission('hr.exit'), staffController.reviewExitRequest);

router.get('/leave-policies', staffController.getLeavePolicies);
router.put('/leave-policies/:leave_type', requirePermission('hr.leaves'), staffController.updateLeavePolicy);
router.post('/leave-policies/carry-forward', requirePermission('hr.leaves'), staffController.processLeaveCarryForward);

router.get('/', staffController.getAll);
router.post('/', requirePermission('hr.staff'), staffController.create);

router.get('/:id', staffController.getById);
router.get('/:id/attendance', staffController.getStaffAttendance);
router.get('/:id/salary-payments', staffController.getSalaryPayments);
router.put('/:id', requirePermission('hr.staff'), staffController.update);
router.delete('/:id', requirePermission('hr.staff'), staffController.delete);
router.post('/:id/salary-payment', requirePermission('hr.payroll'), staffController.paySalary);

module.exports = router;
