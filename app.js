// Required Libraries
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');

//// Sequelize?
//var models = require('./models');
//var User = models.User;
//var Reservation = models.Reservation;

// Require Passport
var passport = require('passport');
var session = require('express-session');
var localStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var bcrypt = require('bcrypt');

// Require Routes
var index = require('./routes/index');

// Server Parameters
var app = express();

app.use(express.static(path.join(__dirname, '/public')));

var server = app.listen(3000, function() {
    var port = server.address().port;

    console.log('Listening on port: ', port);

});

// Define Session
app.use(session({
    secret: 'secret',
    key: 'user',
    resave: 'true',
    saveUninitialized: false,
    cookie: {maxAge: null, secure: false}
}));

// Passport Init
app.use(passport.initialize());
app.use(passport.session());

// Passport Local
passport.use('local', new localStrategy({passReqToCallback: true, usernameField: 'email'},
    function(request, email, password, done) {
        User.find({
            where: {
                'email': email
            }
        }).then(function(user) {
            if (user == null) {
                return done(null, false, {message: 'Incorrect username or password.'})
            }

            bcrypt.compare(password, user.password, function(err, isMatch) {
                if (err) return console.log(err);
                if (isMatch) {
                    return done(null, user);
                } else {
                    done(null, false, {message: 'Incorrect username or password'})
                }
            })
        })
    }));

// Passport Facebook
var configAuth = require('./auth');

passport.use(new FacebookStrategy({

        // pull in our app id and secret from our auth.js file
        clientID: configAuth.facebookAuth.clientID,
        clientSecret: configAuth.facebookAuth.clientSecret,
        callbackURL: configAuth.facebookAuth.callbackURL,
        enableProof: true,
        profileFields: ["emails", "displayName"]

    },

    // facebook will send back the token and profile
    function (token, refreshToken, profile, done) {

        // asynchronous
        process.nextTick(function () {

            // find the user in the database based on their facebook id
            User.find({
                where: {
                    'faceid': profile.id
                }
            }).then(function (user, err) {

                // if there is an error, stop everything and return that
                // ie an error connecting to the database
                if (err)
                    return done(err);

                // if the user is found, then log them in
                if (user) {
                    return done(null, user); // user found, return that user
                } else {
                    // if there is no user found with that facebook id, create them
                    var newUser = {};

                    // set all of the facebook information in our user model
                    newUser.faceid = profile.id; // set the users facebook id
                    newUser.facetoken = token; // we will save the token that facebook provides to the user
                    newUser.name = profile.displayName; // look at the passport user profile to see how names are returned
                    newUser.email = profile.emails[0].value; // facebook can return multiple emails so we'll take the first

                    // save our user to the database
                    User.create(newUser)
                        .catch(function (err) {
                            if (err) {
                                console.log(err);
                            }
                        })
                        .then(function (user) {
                            return done(null, user);
                        });

                    //// if successful, return the new user
                    //return done(null, newUser);
                }

            })

        });
    }
));

// Passport Serialize/Deserialize
passport.serializeUser(function (user, done) {
    done(null, user.id)
});

passport.deserializeUser(function (id, done) {
    User.find({
        where: {
            'id': id
        }
    }).then(function (user) {
        if (user == null) {
            done(new Error('Wrong user id.'))
        }

        done(null, user)
    })
});

// Routes
app.use('/', index);

app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));
app.get('/auth/facebook/callback',
    passport.authenticate('facebook', {
        successRedirect : '/confirmReservation',
        failureRedirect : '/login'
    })
);

// TODO: TWILIO

////require the Twilio module and create a REST client
//var ACCOUNT_SID = 'ACa191532f90a93e915f16da74ef789a7a';
//var AUTH_TOKEN = 'e9ccd52f2d96b3801435c108ca0470ba';
//
////SETUP CRON JOB FOR TWILIO
//var client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
//var CronJob = require('cron').CronJob;
//var job = new CronJob('00 00 14 * * *', function(){
//    var nextDayStart = moment().add('days', 1).set('hour', 00).set('minute', 00).format('YYYY-MM-DD HH:mm');
//    var nextDayEnd = moment().add('days', 1).set('hour', 23).set('minute', 59).format('YYYY-MM-DD HH:mm');
//    var tomorrowFormatted = moment(nextDayStart).format("dddd, MMM DD, YYYY");
//    Reservation.findAll({
//        where : {
//            datetime: {
//                $between: [nextDayStart, nextDayEnd]
//            }
//        }
//    }).then(function(response){
//        var reservationsList = response;
//
//        for(var i = 0; i < reservationsList.length; i++) {
//            var resTime = moment(reservationsList[i].datetime).format("h:mm A");
//            var resName = reservationsList[i].name;
//            var resPhoneNumber = reservationsList[i].phonenumber;
//            if (resPhoneNumber != null) {
//                if(resPhoneNumber != 0) {
//                    sendReminder(resPhoneNumber, resTime, tomorrowFormatted);
//                }
//            }
//
//            function sendReminder(phonenumber, time, date) {
//                var to = '+1' + phonenumber;
//                var body = "This is a friendly reminder that you have scheduled a tee time at Can Can Wonderland for " + time + " tomorrow, " + date + ". See you on the green!";
//                console.log(to);
//                console.log(body);
//            }
//
//            //Send an SMS text message
//            //    function sendReminder(phonenumber, time, date) {
//            //        client.sendMessage({
//            //
//            //            to: '+1' + phonenumber, // Any number Twilio can deliver to
//            //            from: '+16513831380', // A number you bought from Twilio and can use for outbound communication
//            //                body: "This is a friendly reminder that you have scheduled a tee time at Can Can Wonderland for " + time + " tomorrow, " + date + ". See you on the green!";
//            //
//            //        }, function (err, responseData) { //this function is executed when a response is received from Twilio
//            //
//            //            if (!err) {
//            //                console.log(responseData.from); // outputs "+14506667788"
//            //                console.log(responseData.body); // outputs "word to your mother."
//            //            }
//            //        });
//            //    }
//        }
//    });
//}, null, true);
//job.start();



module.exports = app;