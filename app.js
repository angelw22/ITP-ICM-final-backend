var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const WebSocket = require("ws");

let clientArr = {}; 


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


app.use("/",express.static(path.resolve(__dirname, "../client")))

const myServer = app.listen(9876)       // regular http server using node express which serves your webpage

const wsServer = new WebSocket("wss://icm-finals-backend-b895b729e5ed.herokuapp.com:9876/myWebsocket")                                      
// a websocket server

wsServer.getUniqueID = function () {
  function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4();
};

wsServer.on("connection", function(ws) {    // what should a websocket do on connection
    ws.id = wsServer.getUniqueID();

    ws.on("message", function(msg) {        // what to do on message event
      if (msg.toString() !== "undefined") {

        if (JSON.parse(msg).type === "init") {
          let data = JSON.parse(msg).data;
          clientArr[ws.id] = data;
        }

        if (JSON.parse(msg).type === "update") {
          let coords = JSON.parse(msg).data;
          clientArr[ws.id].x = coords.x;
          clientArr[ws.id].y = coords.y;
        }

        if (JSON.parse(msg).type === "connect") {
          // data format: [otherPlayerID, r, g, b];
          let data = JSON.parse(msg).data;
          let otherPlayerID = data[0];



          clientArr[ws.id].connections = {
            ...clientArr[ws.id].connections,
            [otherPlayerID]: {r: data[1], g: data[2], b: data[3]}
          } 
          console.log('connected', clientArr[ws.id])

          clientArr[otherPlayerID].connections = {
            ...clientArr[otherPlayerID].connections,
            [ws.id]: {r: data[1], g: data[2], b: data[3]}
          } 

          clientArr[otherPlayerID].r = data[1];
          clientArr[otherPlayerID].g = data[2];
          clientArr[otherPlayerID].b = data[3];

          // clientArr[otherPlayerID].connections[ws.id] = {r: data[1], g: data[2], b: data[3]};
          wsServer.clients.forEach(function each(client) {
            if (client.id == otherPlayerID) {
              console.log('sending color change to to ', otherPlayerID)
              client.send(JSON.stringify({type: "changeColor", data: [data[1], data[2], data[3]]}))
            } 
          })

        
        }

        if (JSON.parse(msg).type === "disconnect") {
          let otherPlayerID = JSON.parse(msg).data;
          console.log('deleting', otherPlayerID);


          delete clientArr[ws.id].connections[otherPlayerID];
          delete clientArr[otherPlayerID].connections[ws.id];

          console.log(clientArr)
        }

        wsServer.clients.forEach(function each(client) {
          if (client.id !== ws.id && client.readyState === WebSocket.OPEN) {     // check if client is ready
            // client.send(msg.toString());
            console.log('sending to active', clientArr);
            let trimmedData = structuredClone(clientArr);
            delete trimmedData[client.id]
            client.send(JSON.stringify({type: "update", data: trimmedData}))
          } 
        })
      }
    })

    ws.on("close", () => {
      console.log("deleting ", ws.id);
      delete clientArr[ws.id] 
    })


    ws.send(JSON.stringify({type: "firstCon", data: ws.id}))
})

function sendAll (message) {
  for (var i=0; i<clients.length; i++) {
      clients[i].send("Message: " + message);
  }
}



myServer.on('upgrade', async function upgrade(request, socket, head) {      //handling upgrade(http to websocekt) event

    // accepts half requests and rejects half. Reload browser page in case of rejection
    
    if(Math.random() > 0.5){
        return socket.end("HTTP/1.1 401 Unauthorized\r\n", "ascii")     //proper connection close in case of rejection
    }
    
    //emit connection when request accepted
    wsServer.handleUpgrade(request, socket, head, function done(ws) {
      wsServer.emit('connection', ws, request);
    });
});


module.exports = app;
