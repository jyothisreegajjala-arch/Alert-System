const express = require('express');
const router = express.Router();
const {
  createLinkRequest,
  getResponderLinkRequests,
  getSeniorLinkRequests,
  acceptLinkRequest,
  rejectLinkRequest,
  unlinkAccount
} = require('../controllers/linkRequestController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createLinkRequest);
router.get('/responder', protect, getResponderLinkRequests);
router.get('/senior', protect, getSeniorLinkRequests);
router.put('/:requestId/accept', protect, acceptLinkRequest);
router.put('/:requestId/reject', protect, rejectLinkRequest);
router.delete('/:requestId/unlink', protect, unlinkAccount);

module.exports = router;
