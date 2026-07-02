const express    = require('express');
const router     = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl       = require('../controllers/announcementController');

router.get('/active', ctrl.getActive);        // public — main app reads this
router.get('/',       authenticate, ctrl.getAll);
router.post('/',      authenticate, ctrl.create);
router.put('/:id',    authenticate, ctrl.update);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
