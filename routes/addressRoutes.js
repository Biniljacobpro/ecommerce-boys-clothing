const express = require('express');
const router = express.Router();
const {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getAddressCount
} = require('../controllers/addressController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getAddresses)
  .post(addAddress);

router.route('/:id')
  .put(updateAddress)
  .delete(deleteAddress);


router.get('/count', getAddressCount);
router.put('/:id/set-default', setDefaultAddress);



module.exports = router;