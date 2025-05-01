const express = require("express");
const fileUpload = require("express-fileupload");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const socketIo = require("socket.io")
const nodemailer = require("nodemailer")

const http = require("http");
dotenv.config()

//import routes
const authRouter = require("./src/router/authRouter")
const userRouter = require("./src/router/userRouter")
const chatRouter = require("./src/router/chatRouter")
const messageRouter = require("./src/router/messageRouter")
const User = require("./src/model/userModel")

const app = express();
const PORT = process.env.PORT || 4001;

const server = http.createServer(app)
const io = socketIo(server, {
    cors: {
        origin: "*"
    }
})

//middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true }))
app.use(cors())

//use routes
app.use("/auth", authRouter)
app.use(userRouter)
app.use(chatRouter)
app.use(messageRouter)

//socket codes
let activeUsers = []

io.on("connection", (sokcet) => {
    sokcet.on("new-user-add", (newUserId) => {
        if (!activeUsers.some(user => user.userId === newUserId)) {
            activeUsers.push({ userId: newUserId, sokcetId: sokcet.id })
        }

        io.emit("get-users", activeUsers)
    })

    sokcet.on("disconnect", async () => {
        const disconnectedUser = activeUsers.find(user => user.sokcetId === sokcet.id);

        if (disconnectedUser) {
            activeUsers = activeUsers.filter(user => user.sokcetId !== sokcet.id);

            try {
                const exitedTime = new Date().toISOString();
                await User.findByIdAndUpdate(disconnectedUser.userId, { exitedTime });

                io.emit("user-exited", {
                    userId: disconnectedUser.userId,
                    exitedTime
                });
            } catch (error) {
                console.error(error)
            }
        }

        io.emit("get-users", activeUsers);
    });

    sokcet.on("send-message", (data) => {
        const { id } = data
        const user = activeUsers.find(user => user.userId === id)

        if (user) {
            io.to(user.sokcetId).emit("return-message", data)
        }
    })

    sokcet.on("send-typing", (data) => {
        const { idx } = data
        const user = activeUsers.find(user => user.userId === idx)

        if (user) {
            io.to(user.sokcetId).emit("return-typing", data)
        }
    })

    sokcet.on("delete-user", (data) => {
        const { _id } = data

        const user = activeUsers.find(user => user.userId === _id)
        if (user) {
            io.to(user.sokcetId).emit("return-deluser", data)
        }
    })
});

const MONGO_URL = process.env.MONGO_URL
mongoose.connect(MONGO_URL).then(() => {
    server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))
}).catch((err) => {
    console.log(err);
})