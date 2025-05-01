const router = require("express").Router()
const authCtrl = require("../controller/authCtrl")

router.post("/signup", authCtrl.signup)
router.post("/login", authCtrl.login)
router.post("/verify-code", authCtrl.verifyCode)
router.post("/signupforme", authCtrl.signupforme)

module.exports = router