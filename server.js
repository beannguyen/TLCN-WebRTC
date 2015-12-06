// Load required modules
var http    = require("http");              // http server core module
var express = require("express");           // web framework external module
var io      = require("socket.io");         // web socket external module
var easyrtc = require("easyrtc");           // EasyRTC external module
var mongoose = require('mongoose');

// Setup and configure Express http server. Expect a subfolder called "static" to be the web root.
var httpApp = express();

httpApp.use(express.static(__dirname + "/rtc_app/"));
httpApp.use('/bower_components',  express.static(__dirname + '/bower_components'));

// Start Express http server on port 8080
var webServer = http.createServer(httpApp).listen(9001, function () {
    console.log('listen on *:9001');
});

// Start Socket.io so it attaches itself to Express server
var socketServer = io.listen(webServer, {"log level":1});

// Start EasyRTC server
var rtc = easyrtc.listen(httpApp, socketServer,{logLevel:"debug", logDateEnable:true}, function(err, rtc) {

    // After the server has started, we can still change the default room name
    rtc.setOption("roomDefaultName", "SectorZero");

    // Creates a new application called MyApp with a default room named "SectorOne".
    rtc.createApp(
        "multipleChanel",
        {"roomDefaultName":"SectorOne"},
        myEasyrtcApp
    );
});

// Setting option for specific application
var myEasyrtcApp = function(err, appObj) {
    // All newly created rooms get a field called roomColor.
    // Note this does not affect the room "SectorOne" as it was created already.
    appObj.setOption("roomDefaultFieldObj",
        {"roomColor":{fieldValue:"orange", fieldOption:{isShared:true}}}
    );
};

// connect to database
mongoose.connect('mongodb://127.0.0.1/elearning');

// Models
var User = mongoose.model('User', {username: String, easyRtcId: {type: String, default: ''}, email: String, fullname: String, isConnected: { type: Boolean, default: false }});
var Message = mongoose.model('Message', {author: String, content: String, createdAt: { type: Date, default: Date.now }, room: String});

socketServer.on('connection', function (socket) {
    console.log('new user connected');

    // init variables
    socket.room = 'publish chat';

    socket.on('disconnect', function(){
        console.log('user disconnected');
    });

    // create account
    socket.on('create account', function (credential) {

        User.findOne({
            username: credential.username
        }, function (err, obj) {
            if (err) {
                console.log('Find user with an error', err);

                socket.emit('created account', {
                    msg: 'error'
                });
            } else if (obj) { // account already existed

                socket.emit('created account', {
                    msg: 'account_exist'
                });
            } else {
                var user = new User({
                    username: credential.username,
                    easyRtcId: '',
                    email: credential.email,
                    fullname: credential.fullname,
                    isConnected: false
                });

                // save to db
                user.save(function (error, obj) {
                    if (error) {
                        console.log('Something went wrong when try to save new user to mongodb', error);
                        socket.emit('created account', {
                            msg: 'error'
                        });
                    } else if (obj) {
                        console.log('saved new account successfully', obj);
                        socket.emit('created account', {
                            msg: 'created'
                        });
                    }
                });
            }
        });
    });

    /**
     * Check credential and process login
     */
    socket.on('user login', function (credential) {
        User.findOne({username: credential.username}, function (err, obj) {
            if (err) {
                console.log('Something went wrong!');
            } else if (obj) {
                socket.user = obj;
                socket.emit('logging in', {msg: 'success', user: obj});
            } else {
                socket.emit('logging in', {msg: 'username incorrect'});
            }
        })
    });

    /**
     * invoked when user initialed rtc options
     */
    socket.on('user logged in rtc', function (_user) {
        User.findOne({username: _user.username}, function (err, user) {
            if (err) {
                console.log('Something went wrong!');
            } else if (user) {
                user.easyRtcId = _user.easyRtcId;
                user.isConnected = true;
                user.save();
                socket.user = user;
                socket.join(socket.room);

                // find all users
                User.find({}, function (err, users) {
                    if(err) {
                        console.log('Something went wrong!');
                    } else if (users) {

                        // alert updated
                        socket.emit('updated easyRtcId', {msg: 'success', data: users});
                    }
                });
            }
        });
    });

    socket.on('send message', function (data) {
        // save this message to db
        var message = new Message({
            author: data.sender._id,
            content: data.content,
            room: data.room
        });

        message.save(function (err, obj) {
            if (err) {
                console.log('Cannot save the message!');
            } else if (obj) {
                socketServer.sockets.in(data.room).emit('sent message', data);
            }
        })
    })
});