const { FRONTEND_DOMAIN, NODE_ENV, SERVER_PORT } = require("./config");

const { logger } = require("./config/logger");

const connectDB = require("./config/connectDB");

const path = require("path");

const express = require("express"),
  bodyParser = require("body-parser"),
  cors = require("cors"),
  app = express();
(cookieParser = require("cookie-parser")), app.use(cookieParser());

const http = require("http");
const socketIO = require("socket.io");

var corsOptions = {
  origin: `${FRONTEND_DOMAIN}`,
  methods: "GET,HEAD,POST,PATCH,DELETE,OPTIONS,PUT",
  credentials: true, // required to pass
  allowedHeaders: "Content-Type, Authorization, X-Requested-With",
};

app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/server", function (req, res) {
  return res.send("Server is up !");
});

//connect to db
connectDB();

//defines routes
require("./routes/routes")(app);

// our server instance
const server = http.createServer(app);

// This creates our socket using the instance of the server
const io = socketIO(server);

io.on("connection", (socket) => {
  logger.trace("New client connected = " + socket.id);

  let Counter = require("./models/Counter");

  // when the client emits 'adduser', this listens and executes
  socket.on("adduser", (roomName) => {
    logger.trace("USER = " + socket.id);

    // store the room name in the socket session for this client

    logger.trace("Leaving previous Room");
    if (socket.room != roomName) socket.leave(socket.room);

    socket.room = roomName;
    // add the client's username to the global list
    // send client to room 1
    socket.join(roomName);

    io.sockets.in(socket.room).emit("change_data");

    logger.trace("User added to room = " + roomName);
  });

  // Returning the initial data
  socket.on("initial_data", (id) => {
    logger.debug("initial_data " + id);
    Counter.findOne({ code: id }).then((docs) => {
      logger.debug("Found data" + docs);
      io.sockets.in(socket.room).emit("get_data", docs);
    });
  });

  socket.on("addCounter", (id) => {
    logger.debug("Calling add counter");
    logger.trace("USER = " + socket.id);

    Counter.updateOne(
      { code: "total" },
      { $inc: { counter: 1 } }
    ).then((updatedDoc) => {});

    Counter.updateOne({ code: id }, { $inc: { counter: 1 } }).then(
      (updatedDoc) => {
        // Emitting event to update the Counter across the devices with the realtime value
        io.sockets.in(socket.room).emit("change_data");
      }
    );
  });

  socket.on("subtractCounter", (id) => {
    logger.debug("Calling subtract Counter");

    Counter.updateOne({ code: id }, { $inc: { counter: -1 } }).then(
      (updatedDoc) => {
        // Emitting event to update the Counter across the devices with the realtime value
        io.sockets.in(socket.room).emit("change_data");
      }
    );
  });

  // disconnect is fired when a client leaves the server
  socket.on("disconnect", () => {
    logger.trace("User disconnected");
    socket.leave(socket.room);
  });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client/build")));

  app.get("*", function (req, res) {
    res.sendFile(path.join(__dirname, "client/build", "index.html"));
  });
}

// set port, listen for requests
var port = process.env.PORT || SERVER_PORT;
server.listen(port, () => {
  logger.info(`Server started on port=${port} environment=${NODE_ENV}.`);
});

module.exports = server;
