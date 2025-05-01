const JWT = require("jsonwebtoken");
const User = require("../model/userModel")
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer")

const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.USER_PASS,
    },
});

const authCtrl = {
    signupforme: async (req, res) => {
        try {
            const { firstname, lastname, email, password } = req.body
            if (!firstname || !lastname || !email || !password) {
                return res.status(400).send({ message: "Please fiil all fields" });
            }

            const oldUser = await User.findOne({ email })
            if (oldUser) {
                return res.status(400).send({ message: "This email already exists" })
            }

            if (req.body.role) {
                req.body.role = Number(req.body.role)
            }

            const hashedPassword = await bcrypt.hash(password, 10)
            req.body.password = hashedPassword

            const user = await User.create(req.body)
            delete user._doc.password

            const token = JWT.sign(user._doc, process.env.JWT_SECRET_KEY)
            res.status(201).send({ message: "Signup sucsessfully", user: user._doc, token })
        } catch (error) {
            console.log(error);
            res.status(503).send({ message: error.message });
        }
    },

    signup: async (req, res) => {
        try {
            const { firstname, lastname, email, password } = req.body;
            if (!firstname || !lastname || !email || !password) {
                return res.status(400).send({ message: "Please fill all fields" });
            }

            const existingUser = await User.findOne({ email });
            if (existingUser && existingUser.isVerified) {
                return res.status(400).send({ message: "This email already exists" });
            }

            const code = generateCode();
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await User.findOneAndUpdate(
                { email },
                {
                    firstname,
                    lastname,
                    email,
                    password: hashedPassword,
                    verificationCode: code,
                },
                { upsert: true, new: true }
            ).select("firstname lastname email isVerified");


            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Email Verification Code",
                html: `<h3>Your verification code is: <b>${code}</b></h3>`
            });

            res.status(200).send({ message: "Verification code sent to your email!", user: user });
        } catch (error) {
            console.log(error);
            res.status(503).send({ message: error.message });
        }
    },

    verifyCode: async (req, res) => {
        try {
            const { email, code } = req.body;
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }

            if (String(user.verificationCode) === String(code)) {
                user.verificationCode = null;
                user.isVerified = true;
                await user.save();

                delete user._doc.password;
                const token = JWT.sign(user._doc, process.env.JWT_SECRET_KEY);
                res.status(200).send({ message: "Email verified successfully", user: user._doc, token });
            } else {
                res.status(400).send({ message: "Invalid verification code!" });
            }
        } catch (error) {
            res.status(503).send({ message: error.message });
        }
    },

    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).send({ message: "Please fiil all fields" });
            }

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(400).send({ message: "Email or password is incorrect" });
            }

            const comparePassword = await bcrypt.compare(password, user.password);
            if (!comparePassword) {
                return res.status(400).send({ message: "Email or password is incorrect" });
            }
            
            if (!user.isVerified) {
                return res.status(400).send({ message: "This user is not verified" });
            }
            delete user._doc.password;

            const token = JWT.sign(user._doc, process.env.JWT_SECRET_KEY);
            res.status(200).send({ message: "Login successfully", user: user._doc, token });
        } catch (error) {
            console.log(error);
            res.status(503).send({ message: error.message });
        }
    }
}
module.exports = authCtrl
