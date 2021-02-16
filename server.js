'use strict';
require('dotenv').config();
const cors = require("cors");
const express = require('express');
const myDB = require('./connection');
const session = require('express-session');
const passport = require('passport');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const routes = require('./routes.js');
const auth = require('./auth.js');
const passportSocketIo = require('passport.socketio'); 
const cookieParser = require('cookie-parser');

const MongoStore = require('connect-mongo')(session);
const URI = process.env.MONGO_URI;
const store = new MongoStore({ url: URI });

const app = express();
app.use(cors());
app.set('view engine', 'pug');

const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session());

io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: 'express.sid',
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail
  })
);

myDB(async client => {
  const myDataBase = await client.db('fcc-db-advanced-node-and-express').collection('fcc-collection-advanced-node-and-express');

  routes(app, myDataBase);
  auth(app, myDataBase);

  let currentUsers = 0;
  io.on('connection', socket => {
    ++currentUsers;
    io.emit('user count', currentUsers);
    io.emit('user', {
      name: socket.request.user.name,
      currentUsers,
      connected: true
    });
    console.log('user ' + socket.request.user.name + ' connected');
    console.log('A user has connected');
    socket.on('disconnect', () => {
      /*anything you want to do on disconnect*/
      --currentUsers;
      io.emit('user count', currentUsers);
      io.emit('user', {
        name: socket.request.user.name,
        currentUsers,
        connected: false
      });
      console.log('A user has disconnected');
      socket.on('chat message', message => {
        io.emit('chat message', {
          name: socket.request.user.name,
          message
        });
      });
    });
  });
  // Be sure to change the title
}).catch(e => {
  app.route('/').get((req, res) => {
    res.render('pug', { title: e, message: 'Unable to login' });
  });
});  

fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function onAuthorizeSuccess(data, accept) {
  console.log('successful connection to socket.io');

  accept(null, true);
}

function onAuthorizeFail(data, message, error, accept) {
  if (error) throw new Error(message);
  console.log('failed connection to socket.io:', message);
  accept(null, false);
}

http.listen(process.env.PORT || 3000, () => {
  console.log('Listening on port ' + process.env.PORT);
});

/*app.route('/').get((req, res) => {
  res.render('pug/index', {title: 'Hello', message: 'Please login'});
});*/
